import { Link } from 'react-router-dom'

// Who to contact at a vendor (RAMP-145): name, email and phone, with mailto/tel links.
// `showName` adds the vendor's name as a link to its page.
export default function VendorContact({ vendor, showName = true, className = '' }) {
  if (!vendor) return null
  const reach = [
    vendor.email && <a key="email" href={`mailto:${vendor.email}`}>{vendor.email}</a>,
    vendor.phone && <a key="phone" href={`tel:${vendor.phone.replace(/[^\d+]/g, '')}`}>{vendor.phone}</a>,
  ].filter(Boolean)

  return (
    <span className={`vendor-contact ${className}`.trim()}>
      {showName && <Link className="vendor-name" to={`/vendors/${vendor.id}`}>{vendor.name}</Link>}
      <span className="vendor-person">
        {vendor.contact_name || <span className="missing-text">No contact person</span>}
      </span>
      {reach.length > 0 && (
        <span className="vendor-reach">
          {reach.flatMap((link, i) => (i ? [<span key={`sep-${i}`} aria-hidden="true"> · </span>, link] : [link]))}
        </span>
      )}
    </span>
  )
}
