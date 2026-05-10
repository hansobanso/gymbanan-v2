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
