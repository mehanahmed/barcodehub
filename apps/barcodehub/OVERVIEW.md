# BarcodeHub

A multi-tenant barcode SaaS for Bangladeshi brands and manufacturers.

- **Brands (tenants)** sign up, add products (images, description, manufacturer, weight, certifications), and generate EAN-13 / UPC-A barcodes from their GS1 prefix or system Code128 + QR codes. They can print label sheets, see view/scan analytics, and pay for packages via bKash/Nagad/Rocket/bank transfer by submitting a transaction ID.
- **The public** finds each product at `/barcode/<number>` — a search-engine-friendly page meant to show up when someone searches the barcode or scans it with Google Lens — plus a barcode lookup page and brand profile pages.
- **The SaaS owner** uses `/admin` to approve payments, manage tenants and packages, and see platform revenue and growth. Access is limited to emails in the Admins table.
