import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://txwszpetcouyfoyhimmr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4d3N6cGV0Y291eWZveWhpbW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODY5OTcsImV4cCI6MjA5MDM2Mjk5N30.T9RrIgnXJUwkvWWtYqlKku2ulbU5PfyPu3TEm9xQbcM'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const EXERCISES = {
  // ── Bröst ─────────────────────────────────────────────────
  'Bänkpress':                  { muscle_group: 'Bröst',      secondary_muscle: 'Triceps',    equipment: 'Skivstång',  movement_pattern: 'Press' },
  'Lutande bänkpress':          { muscle_group: 'Bröst',      secondary_muscle: 'Triceps',    equipment: 'Skivstång',  movement_pattern: 'Press' },
  'Bänkpress med hantlar':      { muscle_group: 'Bröst',      secondary_muscle: 'Triceps',    equipment: 'Hantel',     movement_pattern: 'Press' },
  'Lutande hantelbänkpress':    { muscle_group: 'Bröst',      secondary_muscle: 'Triceps',    equipment: 'Hantel',     movement_pattern: 'Press' },
  'Kabelkorsning':              { muscle_group: 'Bröst',      secondary_muscle: 'Axlar',      equipment: 'Kabel',      movement_pattern: 'Press' },
  'Pec deck':                   { muscle_group: 'Bröst',      secondary_muscle: 'Axlar',      equipment: 'Maskin',     movement_pattern: 'Isolation' },
  'Push-up':                    { muscle_group: 'Bröst',      secondary_muscle: 'Triceps',    equipment: 'Kroppsvikt', movement_pattern: 'Press' },
  'Dips':                       { muscle_group: 'Bröst',      secondary_muscle: 'Triceps',    equipment: 'Kroppsvikt', movement_pattern: 'Press' },
  'Chest press maskin':         { muscle_group: 'Bröst',      secondary_muscle: 'Triceps',    equipment: 'Maskin',     movement_pattern: 'Press' },
  // ── Rygg ──────────────────────────────────────────────────
  'Marklyft':                   { muscle_group: 'Rygg',       secondary_muscle: 'Hamstrings', equipment: 'Skivstång',  movement_pattern: 'Hinge' },
  'Sumomarklyft':               { muscle_group: 'Rygg',       secondary_muscle: 'Rumpa',      equipment: 'Skivstång',  movement_pattern: 'Hinge' },
  'Latsdrag':                   { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Latsdrag bred neutral':      { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Latsdrag overhands':         { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Latsdrag enarms':            { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Sittrodd':                   { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Sittrodd nära':              { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Sittrodd bred neutral':      { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Skivstångsrodd':             { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Skivstång',  movement_pattern: 'Drag' },
  'Enarms hantelrodd':          { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Hantel',     movement_pattern: 'Drag' },
  'Chest supported row':        { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Chest supported row neutral':{ muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Chest supported row nära':   { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  'Lutande rodd':               { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Hantel',     movement_pattern: 'Drag' },
  'T-stångsrodd':               { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Skivstång',  movement_pattern: 'Drag' },
  'Ryggextension':              { muscle_group: 'Rygg',       secondary_muscle: 'Rumpa',      equipment: 'Maskin',     movement_pattern: 'Hinge' },
  'Chin-up':                    { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Kroppsvikt', movement_pattern: 'Drag' },
  'Pullups':                    { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Kroppsvikt', movement_pattern: 'Drag' },
  'Pullups nära neutral':       { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Kroppsvikt', movement_pattern: 'Drag' },
  'Viktad chin-up':             { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Kroppsvikt', movement_pattern: 'Drag' },
  'Assisted chin-ups':          { muscle_group: 'Rygg',       secondary_muscle: 'Biceps',     equipment: 'Maskin',     movement_pattern: 'Drag' },
  // ── Axlar ─────────────────────────────────────────────────
  'Militärpress':               { muscle_group: 'Axlar',      secondary_muscle: 'Triceps',    equipment: 'Skivstång',  movement_pattern: 'Press' },
  'Sittande militärpress':      { muscle_group: 'Axlar',      secondary_muscle: 'Triceps',    equipment: 'Skivstång',  movement_pattern: 'Press' },
  'DB militärpress':            { muscle_group: 'Axlar',      secondary_muscle: 'Triceps',    equipment: 'Hantel',     movement_pattern: 'Press' },
  'Kabelsidolyft':              { muscle_group: 'Axlar',      secondary_muscle: 'Axlar',      equipment: 'Kabel',      movement_pattern: 'Isolation' },
  'DB sidolyft':                { muscle_group: 'Axlar',      secondary_muscle: 'Axlar',      equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Enarms sidolyft':            { muscle_group: 'Axlar',      secondary_muscle: 'Axlar',      equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Frontlyft':                  { muscle_group: 'Axlar',      secondary_muscle: 'Bröst',      equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Face pulls':                 { muscle_group: 'Axlar',      secondary_muscle: 'Rygg',       equipment: 'Kabel',      movement_pattern: 'Drag' },
  'Upright row':                { muscle_group: 'Axlar',      secondary_muscle: 'Biceps',     equipment: 'Skivstång',  movement_pattern: 'Drag' },
  'Shrugs':                     { muscle_group: 'Axlar',      secondary_muscle: 'Axlar',      equipment: 'Skivstång',  movement_pattern: 'Isolation' },
  'Omvända flyes':              { muscle_group: 'Axlar',      secondary_muscle: 'Rygg',       equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Y-raises':                   { muscle_group: 'Axlar',      secondary_muscle: 'Rygg',       equipment: 'Hantel',     movement_pattern: 'Isolation' },
  // ── Biceps ────────────────────────────────────────────────
  'Bicepscurl':                 { muscle_group: 'Biceps',     secondary_muscle: 'Underarmar', equipment: 'Skivstång',  movement_pattern: 'Isolation' },
  'Hammarcurl':                 { muscle_group: 'Biceps',     secondary_muscle: 'Underarmar', equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Hammarcurl kabel':           { muscle_group: 'Biceps',     secondary_muscle: 'Underarmar', equipment: 'Kabel',      movement_pattern: 'Isolation' },
  'Koncentrationscurl':         { muscle_group: 'Biceps',     secondary_muscle: 'Underarmar', equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Predikantbänk curl':         { muscle_group: 'Biceps',     secondary_muscle: 'Underarmar', equipment: 'Skivstång',  movement_pattern: 'Isolation' },
  'Incline biceps curl':        { muscle_group: 'Biceps',     secondary_muscle: 'Underarmar', equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Alternating DB curl':        { muscle_group: 'Biceps',     secondary_muscle: 'Underarmar', equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Kabelbiceps':                { muscle_group: 'Biceps',     secondary_muscle: 'Underarmar', equipment: 'Kabel',      movement_pattern: 'Isolation' },
  // ── Triceps ───────────────────────────────────────────────
  'Triceps pushdown':           { muscle_group: 'Triceps',    secondary_muscle: 'Axlar',      equipment: 'Kabel',      movement_pattern: 'Isolation' },
  'Overhead triceps':           { muscle_group: 'Triceps',    secondary_muscle: 'Axlar',      equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Overhead triceps kabel':     { muscle_group: 'Triceps',    secondary_muscle: 'Axlar',      equipment: 'Kabel',      movement_pattern: 'Isolation' },
  'Skull crushers':             { muscle_group: 'Triceps',    secondary_muscle: 'Axlar',      equipment: 'Skivstång',  movement_pattern: 'Isolation' },
  'Sittande overhead triceps':  { muscle_group: 'Triceps',    secondary_muscle: 'Axlar',      equipment: 'Hantel',     movement_pattern: 'Isolation' },
  'Dips (triceps)':             { muscle_group: 'Triceps',    secondary_muscle: 'Bröst',      equipment: 'Kroppsvikt', movement_pattern: 'Press' },
  'Enarms triceps pushdown':    { muscle_group: 'Triceps',    secondary_muscle: 'Axlar',      equipment: 'Kabel',      movement_pattern: 'Isolation' },
  'Liggande triceps':           { muscle_group: 'Triceps',    secondary_muscle: 'Axlar',      equipment: 'Skivstång',  movement_pattern: 'Isolation' },
  // ── Quads ─────────────────────────────────────────────────
  'Knäböj':                     { muscle_group: 'Quads',      secondary_muscle: 'Rumpa',      equipment: 'Skivstång',  movement_pattern: 'Squat' },
  'Benpress':                   { muscle_group: 'Quads',      secondary_muscle: 'Rumpa',      equipment: 'Maskin',     movement_pattern: 'Squat' },
  'Bensträckare':               { muscle_group: 'Quads',      secondary_muscle: 'Quads',      equipment: 'Maskin',     movement_pattern: 'Isolation' },
  'Utfallssteg':                { muscle_group: 'Quads',      secondary_muscle: 'Rumpa',      equipment: 'Hantel',     movement_pattern: 'Squat' },
  'Bulgariska utfallssteg':     { muscle_group: 'Quads',      secondary_muscle: 'Rumpa',      equipment: 'Hantel',     movement_pattern: 'Squat' },
  'Benböj maskin':              { muscle_group: 'Quads',      secondary_muscle: 'Rumpa',      equipment: 'Maskin',     movement_pattern: 'Squat' },
  'Hack squat':                 { muscle_group: 'Quads',      secondary_muscle: 'Rumpa',      equipment: 'Maskin',     movement_pattern: 'Squat' },
  // ── Hamstrings ────────────────────────────────────────────
  'Rumänsk marklyft':           { muscle_group: 'Hamstrings', secondary_muscle: 'Rygg',       equipment: 'Skivstång',  movement_pattern: 'Hinge' },
  'Bencurl':                    { muscle_group: 'Hamstrings', secondary_muscle: 'Vader',      equipment: 'Maskin',     movement_pattern: 'Isolation' },
  'Sittande bencurl':           { muscle_group: 'Hamstrings', secondary_muscle: 'Vader',      equipment: 'Maskin',     movement_pattern: 'Isolation' },
  'Liggande bencurl':           { muscle_group: 'Hamstrings', secondary_muscle: 'Vader',      equipment: 'Maskin',     movement_pattern: 'Isolation' },
  'Nordisk curl':               { muscle_group: 'Hamstrings', secondary_muscle: 'Vader',      equipment: 'Kroppsvikt', movement_pattern: 'Isolation' },
  // ── Rumpa ─────────────────────────────────────────────────
  'Hip thrust':                 { muscle_group: 'Rumpa',      secondary_muscle: 'Hamstrings', equipment: 'Skivstång',  movement_pattern: 'Hinge' },
  'Cable kickback':             { muscle_group: 'Rumpa',      secondary_muscle: 'Hamstrings', equipment: 'Kabel',      movement_pattern: 'Isolation' },
  'Hip abduktion':              { muscle_group: 'Rumpa',      secondary_muscle: 'Rumpa',      equipment: 'Maskin',     movement_pattern: 'Isolation' },
  'Sumo knäböj':                { muscle_group: 'Rumpa',      secondary_muscle: 'Quads',      equipment: 'Hantel',     movement_pattern: 'Squat' },
  // ── Vader ─────────────────────────────────────────────────
  'Vadpress':                   { muscle_group: 'Vader',      secondary_muscle: 'Vader',      equipment: 'Maskin',     movement_pattern: 'Isolation' },
  'Stående vadpress':           { muscle_group: 'Vader',      secondary_muscle: 'Vader',      equipment: 'Maskin',     movement_pattern: 'Isolation' },
  'Sittande vadpress':          { muscle_group: 'Vader',      secondary_muscle: 'Vader',      equipment: 'Maskin',     movement_pattern: 'Isolation' },
  // ── Core ──────────────────────────────────────────────────
  'Planka':                     { muscle_group: 'Core',       secondary_muscle: 'Axlar',      equipment: 'Kroppsvikt', movement_pattern: 'Carry' },
  'Crunches':                   { muscle_group: 'Core',       secondary_muscle: 'Core',       equipment: 'Kroppsvikt', movement_pattern: 'Isolation' },
  'Benspark':                   { muscle_group: 'Core',       secondary_muscle: 'Core',       equipment: 'Kroppsvikt', movement_pattern: 'Isolation' },
  'Russian twist':              { muscle_group: 'Core',       secondary_muscle: 'Core',       equipment: 'Kroppsvikt', movement_pattern: 'Isolation' },
  'Hängande benlyft':           { muscle_group: 'Core',       secondary_muscle: 'Core',       equipment: 'Kroppsvikt', movement_pattern: 'Isolation' },
  'Maskin crunch':              { muscle_group: 'Core',       secondary_muscle: 'Core',       equipment: 'Maskin',     movement_pattern: 'Isolation' },
  'Ab wheel':                   { muscle_group: 'Core',       secondary_muscle: 'Axlar',      equipment: 'Övrigt',     movement_pattern: 'Isolation' },
  // ── Underarmar ───────────────────────────────────────────
  'Handledscurl':               { muscle_group: 'Underarmar', secondary_muscle: 'Biceps',     equipment: 'Skivstång',  movement_pattern: 'Isolation' },
  'Handledscurl omvänt':        { muscle_group: 'Underarmar', secondary_muscle: 'Triceps',    equipment: 'Skivstång',  movement_pattern: 'Isolation' },
  'Handledsextension':          { muscle_group: 'Underarmar', secondary_muscle: 'Triceps',    equipment: 'Skivstång',  movement_pattern: 'Isolation' },
  'Farmers carry':              { muscle_group: 'Underarmar', secondary_muscle: 'Axlar',      equipment: 'Hantel',     movement_pattern: 'Carry' },
  'Gripen':                     { muscle_group: 'Underarmar', secondary_muscle: 'Underarmar', equipment: 'Övrigt',     movement_pattern: 'Isolation' },
  'Underarmscurl med kabel':    { muscle_group: 'Underarmar', secondary_muscle: 'Biceps',     equipment: 'Kabel',      movement_pattern: 'Isolation' },
}

const rows = Object.entries(EXERCISES).map(([name, data]) => ({
  name,
  muscle_group:      data.muscle_group,
  secondary_muscle:  data.secondary_muscle || null,
  equipment:         data.equipment || null,
  movement_pattern:  data.movement_pattern || null,
  user_id:           null,
  is_global:         true,
}))

console.log(`Seeding ${rows.length} exercises…`)

// Fetch all existing global exercises
const { data: existing, error: fetchErr } = await supabase
  .from('exercises')
  .select('id, name')
  .is('user_id', null)

if (fetchErr) { console.error('Fetch failed:', fetchErr.message); process.exit(1) }

const existingMap = Object.fromEntries((existing ?? []).map(e => [e.name, e.id]))

const toInsert = rows.filter(r => !existingMap[r.name])
const toUpdate = rows.filter(r =>  existingMap[r.name])

console.log(`  Insert: ${toInsert.length}, Update: ${toUpdate.length}`)

if (toInsert.length > 0) {
  const { error: insErr } = await supabase.from('exercises').insert(toInsert)
  if (insErr) { console.error('Insert failed:', insErr.message); process.exit(1) }
}

for (const row of toUpdate) {
  const { error: updErr } = await supabase
    .from('exercises')
    .update({
      muscle_group:     row.muscle_group,
      secondary_muscle: row.secondary_muscle,
      equipment:        row.equipment,
      movement_pattern: row.movement_pattern,
    })
    .eq('id', existingMap[row.name])
  if (updErr) { console.error(`Update failed for "${row.name}":`, updErr.message); process.exit(1) }
}

// Verify
const { count } = await supabase
  .from('exercises')
  .select('*', { count: 'exact', head: true })
  .is('user_id', null)
console.log(`Done. Total global exercises in DB: ${count}`)
