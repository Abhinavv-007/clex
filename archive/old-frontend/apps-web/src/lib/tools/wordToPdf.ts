import mammoth from 'mammoth'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export async function wordToPdf(
  file: File,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  onProgress?.(10)

  // Convert DOCX to HTML using mammoth
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  const html = result.value

  onProgress?.(40)

  // Render HTML to a temporary hidden container
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 794px;
    padding: 48px;
    background: white;
    color: black;
    font-family: Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.6;
    z-index: -1;
  `
  container.innerHTML = html
  document.body.appendChild(container)

  onProgress?.(55)

  // Capture with html2canvas
  const canvas = await html2canvas(container, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  document.body.removeChild(container)
  onProgress?.(80)

  // Build PDF from canvas image(s)
  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pageWidth - margin * 2

  const imgProps = pdf.getImageProperties(imgData)
  const imgHeightMm = (imgProps.height * contentWidth) / imgProps.width
  let remainingHeight = imgHeightMm
  let position = margin

  pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeightMm)
  remainingHeight -= pageHeight - margin * 2

  while (remainingHeight > 0) {
    position -= pageHeight - margin * 2
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeightMm)
    remainingHeight -= pageHeight - margin * 2
  }

  onProgress?.(100)

  const pdfOutput = pdf.output('blob')
  return pdfOutput
}
