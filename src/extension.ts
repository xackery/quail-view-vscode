import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand("quailViewer.open", async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("No active WCE file selected.");
			return;
		}

		const fileUri = editor.document.uri;
		if (!fileUri.path.endsWith(".wce")) {
			vscode.window.showErrorMessage("Selected file is not a .wce file.");
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (!workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found.");
			return;
		}

		// Define cache directory
		const cacheDir = path.join(workspaceFolder, ".quail_cache");
		if (!fs.existsSync(cacheDir)) {
			fs.mkdirSync(cacheDir, { recursive: true });
		}

		// Generate output .gltf path in the cache
		const modelFileName = path.basename(fileUri.fsPath, ".wce") + ".gltf";
		const modelPath = path.join(cacheDir, modelFileName);

		// Run WebAssembly conversion
		try {
			await convertWCEtoGLTF(fileUri.fsPath, modelPath);
		} catch (error) {
			vscode.window.showErrorMessage("Failed to convert WCE file: " + error);
			return;
		}

		// Create and show a new webview panel
		const panel = vscode.window.createWebviewPanel(
			"quailViewer",
			`Preview: ${modelFileName}`,
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		// Convert model path to a file URI for Webview
		const modelUri = vscode.Uri.file(modelPath).toString();

		// Render the webview with Babylon.js
		panel.webview.html = getWebviewContent(modelUri);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }

// Function to run WebAssembly to convert WCE → GLTF
async function convertWCEtoGLTF(inputFile: string, outputFile: string): Promise<void> {
	return new Promise((resolve, reject) => {
		// Assuming "wce2gltf.wasm" is your WebAssembly program
		// Run it using Node.js (modify this to match your actual WASM runner)
		const wasmRunner = `./wasm_runner ${inputFile} ${outputFile}`;

		exec(wasmRunner, (error, stdout, stderr) => {
			if (error) {
				resolve();
				//				reject(stderr || error.message);
			} else {
				resolve();
			}
		});
	});
}

// Webview with Babylon.js GLTF Viewer
function getWebviewContent(modelUri: string): string {
	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quail Viewer</title>
            <script src="https://cdn.babylonjs.com/babylon.js"></script>
            <script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
            <style>
                body { margin: 0; overflow: hidden; }
                canvas { width: 100%; height: 100vh; display: block; }
                .toolbar {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.8);
                    padding: 5px;
                    border-radius: 5px;
                    box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.2);
                }
                button {
                    font-size: 14px;
                    padding: 5px 10px;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <div class="toolbar">
                <button onclick="reloadModel()">Reload</button>
            </div>
            <canvas id="renderCanvas"></canvas>

            <script>
                let engine, scene, camera;
                
                function createScene() {
                    const canvas = document.getElementById("renderCanvas");
                    engine = new BABYLON.Engine(canvas, true);
                    scene = new BABYLON.Scene(engine);

                    camera = new BABYLON.ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 5, BABYLON.Vector3.Zero(), scene);
                    camera.attachControl(canvas, true);
                    
                    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);
                    light.intensity = 0.7;

                    loadModel();

                    engine.runRenderLoop(() => {
                        scene.render();
                    });

                    window.addEventListener("resize", () => {
                        engine.resize();
                    });
                }

                function loadModel() {
                    const modelPath = "${modelUri}";
                    BABYLON.SceneLoader.ImportMesh("", modelPath.substring(0, modelPath.lastIndexOf("/") + 1), modelPath.split("/").pop(), scene, function (meshes) {
                        console.log("Model loaded:", meshes);
                    }, null, function (scene, message) {
                        console.error("Error loading model:", message);
                    });
                }

                function reloadModel() {
                    scene.dispose();
                    createScene();
                }

                createScene();
            </script>
        </body>
        </html>`;
}
