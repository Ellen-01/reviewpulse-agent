import AppKit
import CoreGraphics
import CoreText
import Foundation
import PDFKit

struct ReportPage {
    let title: String
    let lines: [String]
    let diagram: String?
}

let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let reportURL = root.appendingPathComponent("docs/hito2_informe.md")
let logURL = root.appendingPathComponent("docs/hito2_bitacora_ia.md")
let targetURL = root.appendingPathComponent("ReviewPulse-Agent_hito2.pdf")

func parsePages(_ markdown: String, bitacora: String? = nil) -> [ReportPage] {
    var pages: [ReportPage] = []
    var title: String?
    var lines: [String] = []

    func flush() {
        if let title {
            pages.append(ReportPage(title: title, lines: lines, diagram: nil))
        }
        title = nil
        lines = []
    }

    for line in markdown.components(separatedBy: "\n") {
        if line.hasPrefix("<!-- PAGE: ") {
            flush()
            title = line
                .replacingOccurrences(of: "<!-- PAGE: ", with: "")
                .replacingOccurrences(of: " -->", with: "")
        } else if line.hasPrefix("<!-- DIAGRAMA: ") {
            flush()
            let value = line
                .replacingOccurrences(of: "<!-- DIAGRAMA: ", with: "")
                .replacingOccurrences(of: " -->", with: "")
            let parts = value.components(separatedBy: "|")
            if parts.count == 2 {
                pages.append(ReportPage(
                    title: parts[1].trimmingCharacters(in: .whitespaces),
                    lines: [],
                    diagram: parts[0].trimmingCharacters(in: .whitespaces)
                ))
            }
        } else if line == "<!-- BITACORA -->" {
            flush()
            if let bitacora {
                pages.append(contentsOf: parsePages(bitacora))
            }
        } else if title != nil && !line.hasPrefix("<!--") {
            lines.append(line)
        }
    }
    flush()
    return pages
}

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat) -> CGColor {
    CGColor(red: red, green: green, blue: blue, alpha: 1)
}

func font(_ name: String, _ size: CGFloat) -> CTFont {
    CTFontCreateWithName(name as CFString, size, nil)
}

func attributed(_ text: String, fontName: String, size: CGFloat, color: CGColor) -> NSAttributedString {
    NSAttributedString(string: text, attributes: [
        NSAttributedString.Key(kCTFontAttributeName as String): font(fontName, size),
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
    ])
}

func makeAttributedText(_ lines: [String]) -> NSAttributedString {
    let result = NSMutableAttributedString(string: "")
    let navy = color(0.13, 0.19, 0.29)
    let blue = color(0.20, 0.35, 0.57)
    let gray = color(0.32, 0.38, 0.46)

    for rawLine in lines {
        let line = rawLine
            .replacingOccurrences(of: "**", with: "")
            .replacingOccurrences(of: "`", with: "")
        let item: NSAttributedString
        if line.hasPrefix("# ") {
            item = attributed(String(line.dropFirst(2)) + "\n\n", fontName: "Helvetica-Bold", size: 25, color: navy)
        } else if line.hasPrefix("## ") {
            item = attributed(String(line.dropFirst(3)) + "\n", fontName: "Helvetica-Bold", size: 16, color: blue)
        } else if line.hasPrefix("### ") {
            item = attributed(String(line.dropFirst(4)) + "\n", fontName: "Helvetica-Bold", size: 12, color: blue)
        } else if line.hasPrefix("- ") {
            item = attributed("• " + String(line.dropFirst(2)) + "\n", fontName: "Helvetica", size: 10.5, color: navy)
        } else if line.isEmpty {
            item = attributed("\n", fontName: "Helvetica", size: 4, color: gray)
        } else {
            item = attributed(line + "\n", fontName: "Helvetica", size: 10.5, color: navy)
        }
        result.append(item)
    }
    return result
}

func drawLine(_ text: String, x: CGFloat, y: CGFloat, size: CGFloat, bold: Bool, color: CGColor, in context: CGContext) {
    let lineText = attributed(text, fontName: bold ? "Helvetica-Bold" : "Helvetica", size: size, color: color)
    let line = CTLineCreateWithAttributedString(lineText)
    context.textPosition = CGPoint(x: x, y: y)
    CTLineDraw(line, context)
}

func drawPage(_ page: ReportPage, number: Int, total: Int, in context: CGContext) throws {
    let paper = CGRect(x: 0, y: 0, width: 612, height: 792)
    context.beginPDFPage(nil)
    context.setFillColor(color(1, 1, 1))
    context.fill(paper)
    context.setFillColor(color(0.13, 0.19, 0.29))
    context.fill(CGRect(x: 0, y: 748, width: 612, height: 44))

    drawLine("ReviewPulse-Agent · Hito 2", x: 54, y: 765, size: 11, bold: true,
             color: color(1, 1, 1), in: context)
    drawLine(page.title, x: 335, y: 765, size: 9, bold: false,
             color: color(0.86, 0.90, 0.96), in: context)

    if let diagram = page.diagram {
        let imageURL = root.appendingPathComponent(diagram)
        guard let image = NSImage(contentsOf: imageURL),
              var proposed = Optional(CGRect(origin: .zero, size: image.size)),
              let cgImage = image.cgImage(forProposedRect: &proposed, context: nil, hints: nil) else {
            throw NSError(domain: "Hito2PDF", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "No se pudo cargar el diagrama \(diagram).",
            ])
        }
        let maxWidth: CGFloat = 504
        let maxHeight: CGFloat = 510
        let scale = min(maxWidth / CGFloat(cgImage.width), maxHeight / CGFloat(cgImage.height))
        let width = CGFloat(cgImage.width) * scale
        let height = CGFloat(cgImage.height) * scale
        context.draw(cgImage, in: CGRect(x: (612 - width) / 2, y: 190 + (maxHeight - height) / 2,
                                         width: width, height: height))
        drawLine(diagram, x: 54, y: 145, size: 8, bold: false, color: color(0.32, 0.38, 0.46), in: context)
    } else {
        let text = makeAttributedText(page.lines)
        let framesetter = CTFramesetterCreateWithAttributedString(text)
        let available = CGSize(width: 504, height: 662)
        let measured = CTFramesetterSuggestFrameSizeWithConstraints(
            framesetter, CFRange(location: 0, length: text.length), nil, available, nil
        )
        guard measured.height <= available.height else {
            throw NSError(domain: "Hito2PDF", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "La página “\(page.title)” excede una página (\(Int(measured.height)) pt).",
            ])
        }
        let path = CGPath(rect: CGRect(x: 54, y: 72, width: 504, height: 662), transform: nil)
        let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: text.length), path, nil)
        let visible = CTFrameGetVisibleStringRange(frame)
        guard visible.length == text.length else {
            throw NSError(domain: "Hito2PDF", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "El texto de “\(page.title)” no cabe en una página.",
            ])
        }
        CTFrameDraw(frame, context)
    }

    context.setStrokeColor(color(0.84, 0.87, 0.91))
    context.setLineWidth(0.7)
    context.move(to: CGPoint(x: 54, y: 49))
    context.addLine(to: CGPoint(x: 558, y: 49))
    context.strokePath()
    drawLine("Inteligencia Artificial · Universidad Tecnológica de Bolívar · 13 noviembre 2026",
             x: 54, y: 29, size: 8, bold: false, color: color(0.38, 0.43, 0.51), in: context)
    drawLine("\(number) / \(total)", x: 520, y: 29, size: 8, bold: false,
             color: color(0.38, 0.43, 0.51), in: context)
    context.endPDFPage()
}

let markdown = try String(contentsOf: reportURL, encoding: .utf8)
let bitacora = try String(contentsOf: logURL, encoding: .utf8)
let pages = parsePages(markdown, bitacora: bitacora)
guard !pages.isEmpty else {
    throw NSError(domain: "Hito2PDF", code: 4, userInfo: [NSLocalizedDescriptionKey: "No hay páginas para generar."])
}
guard !FileManager.default.fileExists(atPath: targetURL.path) else {
    throw NSError(domain: "Hito2PDF", code: 5, userInfo: [
        NSLocalizedDescriptionKey: "El PDF de destino ya existe; no se sobrescribió: \(targetURL.path)",
    ])
}

var mediaBox = CGRect(x: 0, y: 0, width: 612, height: 792)
let pdfData = NSMutableData()
guard let consumer = CGDataConsumer(data: pdfData as CFMutableData),
      let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
    throw NSError(domain: "Hito2PDF", code: 6, userInfo: [NSLocalizedDescriptionKey: "No se pudo crear el contexto PDF."])
}

for (index, page) in pages.enumerated() {
    try drawPage(page, number: index + 1, total: pages.count, in: context)
}
context.closePDF()

let temporaryURL = FileManager.default.temporaryDirectory
    .appendingPathComponent("reviewpulse-hito2-\(UUID().uuidString).pdf")
defer { try? FileManager.default.removeItem(at: temporaryURL) }
try (pdfData as Data).write(to: temporaryURL, options: .atomic)

guard let document = PDFDocument(url: temporaryURL), document.pageCount == pages.count else {
    throw NSError(domain: "Hito2PDF", code: 7, userInfo: [NSLocalizedDescriptionKey: "PDFKit no pudo abrir el documento generado."])
}
let progressText = document.page(at: 1)?.string ?? ""
guard progressText.contains("Página de avance") else {
    throw NSError(domain: "Hito2PDF", code: 8, userInfo: [NSLocalizedDescriptionKey: "La página de avance no quedó en la segunda página."])
}
for required in ["Datos y conocimientos listos", "Línea base y resultados", "Bitácora IA", "Pendientes"] {
    let documentText = (0..<document.pageCount).compactMap { document.page(at: $0)?.string }.joined(separator: "\n")
    guard documentText.contains(required) else {
        throw NSError(domain: "Hito2PDF", code: 9, userInfo: [
            NSLocalizedDescriptionKey: "Falta contenido requerido en el PDF: \(required)",
        ])
    }
}

try FileManager.default.moveItem(at: temporaryURL, to: targetURL)
print("PDF generado y validado: \(targetURL.path)")
print("Páginas: \(document.pageCount)")
