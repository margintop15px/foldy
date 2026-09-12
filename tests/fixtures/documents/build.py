"""Reproduce synthetic fixtures using Pillow/reportlab/pypdf; never runs in Foldy.

Fixture filenames delivered to Foldy are neutral. This builder and the oracle
remain outside the scanned root. Run only when intentionally versioning assets.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter

OUT = Path(__file__).parent
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'


def font(size):
    return ImageFont.truetype(FONT, size)


def scene(circles):
    im = Image.new('RGB', (1000, 650), 'white')
    d = ImageDraw.Draw(im)
    for x in [150, 350, 550][:circles]:
        d.ellipse((x-55, 100, x+55, 210), fill='#dc2626')
    for x in [210, 430]:
        d.rectangle((x-60, 390, x+60, 510), fill='#2563eb')
    d.polygon([(810, 170), (715, 390), (905, 390)], fill='#15803d')
    return im


scene(3).save(OUT / 'a.png')
scene(1).save(OUT / 'a-changed.png')
scene(3).save(OUT / 'b.jpg', quality=94)
# EXIF 6 rotates the stored counter-clockwise pixels back to the intended scene.
exif = Image.Exif()
exif[274] = 6
scene(3).transpose(Image.Transpose.ROTATE_90).save(OUT / 'c-oriented.jpg', quality=94, exif=exif)

receipt = Image.new('RGB', (1000, 1150), '#f9f7f2')
d = ImageDraw.Draw(receipt)
d.rectangle((35, 35, 965, 1115), outline='#444444', width=3)
rows = [
    ('MARLOW STATIONERY', 49), ('Receipt RN-582', 40),
    ('Purchase date: 2026-08-19', 36), ('', 35),
    ('Notebooks and desk supplies', 35), ('Total paid: EUR 87.40', 43),
    ('Card payment: PV-2218', 36), ('', 35), ('Thank you', 35),
]
y = 100
for text, size in rows:
    d.text((80, y), text, font=font(size), fill='#111111')
    y += 95
receipt.save(OUT / 'receipt.png')


def pdf(name):
    return canvas.Canvas(str(OUT / name), pagesize=(600, 760), invariant=1)


c = pdf('receipt-scan.pdf')
c.drawImage(ImageReader(receipt), 40, 45, width=520, height=598)
c.save()

c = pdf('statement.pdf')
c.setFont('Helvetica-Bold', 20)
c.drawString(40, 704, 'Card statement - August 2026')
c.setFont('Helvetica', 12)
c.drawString(40, 665, 'Posted date | Payment reference | Merchant | Debit')
c.drawString(40, 630, '2026-08-20 | PV-2218 | Marlow Stationery | EUR 87.40')
c.drawString(40, 595, '2026-08-20 | PV-7720 | Harbor Cafe | EUR 87.40')
c.save()

# The chart is raster-only: its labels and values do not exist in the PDF text layer.
chart = Image.new('RGB', (1000, 640), 'white')
d = ImageDraw.Draw(chart)
left, bottom, top = 110, 530, 55
d.line([(left, top), (left, bottom), (945, bottom)], fill='black', width=3)
for value in [0, 20, 40, 60, 80]:
    y = bottom - value * 5.5
    d.line([(left, y), (945, y)], fill='#cccccc', width=1)
    d.text((40, y-18), str(value), font=font(26), fill='black')
d.text((12, 8), 'C', font=font(30), fill='black')
for x, day, value in [(210, 'Mon', 35), (455, 'Tue', 72), (700, 'Wed', 48)]:
    y = int(bottom - value * 5.5)
    d.rectangle((x, y, x+120, bottom-2), fill='#2563eb')
    d.text((x+28, y-42), str(value), font=font(30), fill='black')
    d.text((x+20, bottom+22), day, font=font(30), fill='black')
chart.save(OUT / 'chart.png')
c = pdf('mixed.pdf')
c.setFont('Helvetica-Bold', 20)
c.drawString(40, 707, 'Sensor trial ST-204')
c.setFont('Helvetica', 14)
c.drawString(40, 673, 'Temperature limit: at most 60 C.')
c.drawString(40, 645, 'The chart shows daily peak temperature.')
c.drawImage(ImageReader(chart), 25, 190, width=550, height=352)
c.save()

c = pdf('long.pdf')
for page in range(1, 13):
    c.setFont('Helvetica-Bold', 20)
    c.drawString(40, 704, 'Harbor sensor rollout HS-610')
    c.setFont('Helvetica', 14)
    lines = ['Before calibration, ensure the workbench is clear.',
             'Store unused sensor modules in their cases.']
    if page == 1:
        lines = ['Operations handbook', 'Calibration owner: Talia.'] + lines
    if page == 12:
        lines = ['Final checklist', 'Calibration due: 2026-12-03.', 'Calibration owner: Talia.',
                 'Request: reserve room Elm for the calibration.', 'The reservation is not yet confirmed.']
    for row, text in enumerate(lines):
        c.drawString(40, 650-row*32, text)
    c.setFont('Helvetica', 11)
    c.drawString(40, 40, f'Page {page} of 12')
    c.showPage()
c.save()

# A real password-protected PDF and a text-heavy page for deterministic limits.
w = PdfWriter()
w.append(str(OUT / 'statement.pdf'))
w.encrypt('synthetic-fixture-password')
with open(OUT / 'encrypted.pdf', 'wb') as f:
    w.write(f)
c = pdf('text-overflow.pdf')
c.setFont('Helvetica', 8)
for i in range(700):
    c.drawString(20, 700-(i % 100)*6, 'Repeated synthetic text for the extraction cap. ' * 3)
c.save()

assert not (PdfReader(OUT / 'receipt-scan.pdf').pages[0].extract_text() or '').strip()
assert '72' not in PdfReader(OUT / 'mixed.pdf').pages[0].extract_text()
assert len(PdfReader(OUT / 'long.pdf').pages) == 12
assert len(PdfReader(OUT / 'text-overflow.pdf').pages[0].extract_text()) > 65536
assets = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
          for p in sorted(OUT.iterdir()) if p.suffix in ('.png', '.jpg', '.pdf')}
(OUT / 'manifest.json').write_text(json.dumps({'revision': 1, 'sha256': assets}, indent=2)+'\n')
