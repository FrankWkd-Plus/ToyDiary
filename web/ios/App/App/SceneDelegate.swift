import UIKit
import Capacitor
import Vision
import CoreImage
import ImageIO

@objc(ToySubjectPlugin)
public class ToySubjectPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ToySubjectPlugin"
    public let jsName = "ToySubject"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "removeBackground", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise)
    ]

    @objc func removeBackground(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else {
            call.reject("自动抠图需要 iOS 17 或更高版本", "UNAVAILABLE")
            return
        }
        guard let dataUrl = call.getString("dataUrl"),
              let comma = dataUrl.firstIndex(of: ","),
              let imageData = Data(base64Encoded: String(dataUrl[dataUrl.index(after: comma)...])),
              let cgImage = downsampledCGImage(imageData) else {
            call.reject("无法读取照片", "INVALID_IMAGE")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let request = VNGenerateForegroundInstanceMaskRequest()
                let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
                try handler.perform([request])
                guard let observation = request.results?.first,
                      !observation.allInstances.isEmpty else {
                    throw NSError(domain: "ToySubject", code: 1, userInfo: [
                        NSLocalizedDescriptionKey: "没有识别到清晰的玩偶主体"
                    ])
                }
                let pixelBuffer = try observation.generateMaskedImage(
                    ofInstances: observation.allInstances,
                    from: handler,
                    croppedToInstancesExtent: true
                )
                let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
                let context = CIContext(options: [.useSoftwareRenderer: false])
                guard let output = context.createCGImage(ciImage, from: ciImage.extent),
                      let png = UIImage(cgImage: output).pngData() else {
                    throw NSError(domain: "ToySubject", code: 2, userInfo: [
                        NSLocalizedDescriptionKey: "无法生成透明贴纸"
                    ])
                }
                call.resolve([
                    "dataUrl": "data:image/png;base64,\(png.base64EncodedString())",
                    "removed": true
                ])
            } catch {
                call.reject(error.localizedDescription, "SEGMENTATION_FAILED", error)
            }
        }
    }

    /// On-device OCR. The WebView path used tesseract.js, which fetched its
    /// worker, wasm core and (20 MB) Chinese model from a CDN at runtime, so
    /// "recognise text in a photo" could never work offline. Vision needs no
    /// bundled model and no network. Unlike the cutout above this is iOS 14+,
    /// which the 15.0 deployment target already covers.
    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let dataUrl = call.getString("dataUrl"),
              let comma = dataUrl.firstIndex(of: ","),
              let imageData = Data(base64Encoded: String(dataUrl[dataUrl.index(after: comma)...])),
              let cgImage = downsampledCGImage(imageData) else {
            call.reject("无法读取照片", "INVALID_IMAGE")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = true
                request.recognitionLanguages = ["zh-Hans", "en-US"]

                let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
                try handler.perform([request])

                let lines = (request.results ?? []).compactMap {
                    $0.topCandidates(1).first?.string
                }
                call.resolve(["text": lines.joined(separator: "\n")])
            } catch {
                call.reject(error.localizedDescription, "RECOGNIZE_FAILED", error)
            }
        }
    }

    /// Camera images can be 12–48 MP. Both the cutout and the OCR above only need
    /// a bounded, correctly oriented source — 2048 px keeps small print legible
    /// while avoiding a full decode of the original photo.
    private func downsampledCGImage(_ data: Data) -> CGImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
            return nil
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 2048,
            kCGImageSourceShouldCacheImmediately: true
        ]
        return CGImageSourceCreateThumbnailAtIndex(
            source,
            0,
            options as CFDictionary
        )
    }
}

final class ToyDiaryBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ToySubjectPlugin())
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = ToyDiaryBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
