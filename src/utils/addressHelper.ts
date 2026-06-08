export function formatAddress(address: string | undefined): string {
  if (!address) return '';
  // Match: (optional Kota/Kabupaten) (City Name) (5-digit postal code) (Province Name) at the end of the address
  const regex = /(?:,\s*|\s+)((?:[Kk]ota|[Kk]ab(?:upaten|\.)?)\s+)?([A-Za-z\s\-'\.]+?)\s+(\d{5})\s+([A-Za-z\s\-'\.]+?)$/;
  const match = address.match(regex);
  if (match) {
    const prefix = match[1] || '';
    const city = match[2].trim();
    const postal = match[3].trim();
    const province = match[4].trim();
    
    if (city.length < 30 && province.length < 30) {
      const beforeMatch = address.slice(0, match.index).trim();
      const formattedCity = `${prefix}${city}`.trim();
      const separator = beforeMatch.endsWith(',') ? ' ' : ', ';
      return `${beforeMatch}${separator}${formattedCity}, ${province}, ${postal}`;
    }
  }
  return address;
}
