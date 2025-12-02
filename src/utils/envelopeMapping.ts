// Mapping logic to associate transactions with envelopes based on category (which is now envelope name)
export const mapTransactionToEnvelope = (descripcion: string, categoria?: string | null): string | null => {
  // If we have a category, use it directly as the envelope name (since AI now uses envelope names as categories)
  if (categoria) {
    return categoria.toUpperCase();
  }

  // Fallback: try to infer from description
  const desc = descripcion.toLowerCase();

  // Direct name matches for fallback
  const directMappings: Record<string, string[]> = {
    'SUPER': ['super', 'walmart', 'soriana', 'chedraui', 'costco', 'bodega aurrera', 'oxxo', 'comida', 'restaurante'],
    'GASOLINA': ['gasolina', 'pemex', 'shell', 'bp', 'gas'],
    'UBER': ['uber', 'didi', 'taxi'],
    'TRANSPORTE LEO': ['transporte leo'],
    'PASAJES VIC': ['pasajes vic', 'pasajes', 'micro', 'camión', 'bus'],
    'NETFLIX': ['netflix'],
    'DISNEY': ['disney'],
    'YOUTUBE': ['youtube'],
    'AMAZON': ['amazon'],
    'APPLE': ['apple', 'app store', 'icloud'],
    'XBOX': ['xbox', 'microsoft'],
    'CFE': ['cfe', 'luz', 'comisión federal'],
    'AGUA': ['agua', 'sistema de aguas'],
    'BANORTE': ['banorte'],
    'ABOGADO': ['abogado', 'legal', 'notaria'],
    'COLEGIATURA MAU': ['colegiatura', 'escuela', 'universidad'],
    'MTO ANGIE': ['mto angie', 'mantenimiento angie'],
    'MTO CARIOTA': ['mto cariota', 'mantenimiento cariota'],
    'MTO JARDINES': ['mto jardines', 'jardin', 'mantenimiento jardines'],
    'FARMACIA': ['farmacia', 'guadalajara', 'similares', 'benavides', 'medicina'],
    'RECARGAS CEL': ['recarga', 'tiempo aire', 'saldo celular', 'telcel', 'at&t', 'movistar'],
    'SEGURO AUDI': ['seguro', 'audi', 'gnp', 'qualitas'],
    'ACEITE': ['aceite', 'motor'],
    'ANTICONGELANTE': ['anticongelante', 'refrigerante'],
    'BEBBIA': ['bebbia'],
    'ABIX': ['abix'],
    'PROPINAS': ['propina'],
  };

  // Check direct mappings
  for (const [envelope, keywords] of Object.entries(directMappings)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return envelope;
    }
  }

  // Default to OTRAS if no match
  return 'OTRAS';
};
