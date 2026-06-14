// Muskelgruppskonstanter och kategoriseringshjalpare.
// Bor i en fristaende fil sa att Admin.jsx kan fortsatta vara lazy-loaded
// utan att andra moduler statiskt drar in den via importer.

export const MUSCLE_GROUPS = [
  'Bröst',
  'Främre axel', 'Mellersta axel', 'Bakre axel',
  'Lats', 'Övre rygg', 'Ländrygg', 'Trapezius',
  'Biceps', 'Triceps', 'Underarmar',
  'Quads', 'Hamstrings', 'Rumpa', 'Adduktorer', 'Abduktorer',
  'Höftböjare', 'Rotatorkuff',
  'Core', 'Vader', 'Övrigt',
]

export const BROAD_MUSCLE_GROUPS = ['Bröst', 'Rygg', 'Axlar', 'Armar', 'Ben', 'Core', 'Övrigt']

// Utrustningsalternativ (delas av admin-sidan och appens ovningsskapande)
export const EQUIPMENT_OPTIONS = [
  'Skivstång', 'Hantel', 'Maskin', 'Kabel',
  'Kroppsvikt', 'Smithmaskin', 'Övrigt',
]

export const SUBDIVISION_TO_BROAD = {
  'Bröst': 'Bröst',
  'Främre axel': 'Axlar', 'Mellersta axel': 'Axlar', 'Bakre axel': 'Axlar',
  'Rotatorkuff': 'Axlar', 'Axlar': 'Axlar',
  'Lats': 'Rygg', 'Övre rygg': 'Rygg', 'Ländrygg': 'Rygg',
  'Trapezius': 'Rygg', 'Rygg': 'Rygg',
  'Biceps': 'Armar', 'Triceps': 'Armar', 'Underarmar': 'Armar',
  'Quads': 'Ben', 'Hamstrings': 'Ben', 'Rumpa': 'Ben',
  'Adduktorer': 'Ben', 'Abduktorer': 'Ben', 'Höftböjare': 'Ben', 'Vader': 'Ben',
  'Core': 'Core',
  'Övrigt': 'Övrigt',
}

export function broadOf(muscleGroup) {
  return SUBDIVISION_TO_BROAD[muscleGroup] ?? 'Övrigt'
}

// Underkategorier per broad-grupp. Visas som andra rad av filter-chips i pickern
// nar en broad-grupp ar vald. Bara broad-grupper som har sub-grupper finns med
// (Brost, Core, Ovrigt har inga sub).
export const SUB_GROUPS = {
  'Rygg': {
    'Övre': ['Lats', 'Övre rygg', 'Trapezius'],
    'Undre': ['Ländrygg'],
  },
  'Axlar': {
    'Främre': ['Främre axel'],
    'Mellersta': ['Mellersta axel'],
    'Bakre': ['Bakre axel'],
    'Rotatorkuff': ['Rotatorkuff'],
  },
  'Armar': {
    'Biceps': ['Biceps'],
    'Triceps': ['Triceps'],
    'Underarmar': ['Underarmar'],
  },
  'Ben': {
    'Främre': ['Quads'],
    'Bakre': ['Hamstrings', 'Rumpa', 'Vader'],
    'Höft': ['Adduktorer', 'Abduktorer', 'Höftböjare'],
  },
}

// Returnera listan av underkategori-namn for en broad-grupp, eller tom array.
export function subGroupsOf(broad) {
  return SUB_GROUPS[broad] ? Object.keys(SUB_GROUPS[broad]) : []
}

// Kolla om en muscle_group hor till en specifik sub-grupp under broad.
export function matchesSubGroup(muscleGroup, broad, subName) {
  const subs = SUB_GROUPS[broad]
  if (!subs || !subs[subName]) return false
  return subs[subName].includes(muscleGroup)
}
