// Mapping logic to associate transactions with envelopes based on description or category
export const mapTransactionToEnvelope = (descripcion: string, categoria?: string | null): string | null => {
  const desc = descripcion.toLowerCase();
  const cat = categoria?.toLowerCase() || '';

  // Direct name matches
  const directMappings: Record<string, string[]> = {
    'SUPER': ['super', 'walmart', 'soriana', 'chedraui', 'costco', 'bodega aurrera'],
    'GASOLINA': ['gasolina', 'pemex', 'shell', 'bp', 'gas'],
    'UBER': ['uber', 'didi', 'taxi'],
    'TRANSPORTE LEO': ['transporte leo'],
    'PASAJES VIC': ['pasajes vic', 'pasajes'],
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

  // Check direct mappings first
  for (const [envelope, keywords] of Object.entries(directMappings)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return envelope;
    }
  }

  // Category-based mappings
  if (cat.includes('transporte') || cat.includes('movilidad')) {
    if (desc.includes('uber') || desc.includes('didi')) {
      return 'UBER';
    }
    return 'GASOLINA';
  }

  if (cat.includes('alimentación') || cat.includes('hogar')) {
    return 'SUPER';
  }

  if (cat.includes('servicios')) {
    if (desc.includes('luz') || desc.includes('cfe')) return 'CFE';
    if (desc.includes('agua')) return 'AGUA';
    if (desc.includes('internet') || desc.includes('izzi') || desc.includes('telmex')) return 'OTRAS';
  }

  if (cat.includes('entretenimiento') || cat.includes('streaming')) {
    if (desc.includes('netflix')) return 'NETFLIX';
    if (desc.includes('disney')) return 'DISNEY';
    if (desc.includes('youtube')) return 'YOUTUBE';
    if (desc.includes('xbox')) return 'XBOX';
  }

  if (cat.includes('salud') || cat.includes('medicina')) {
    return 'FARMACIA';
  }

  // Default to OTRAS if no match
  return 'OTRAS';
};
