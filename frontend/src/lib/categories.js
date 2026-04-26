// Centralized service categories dictionary.
// Maps slug (id) to user-facing label (name) and subcategories.
// Source of truth for the request intervention wizard, used as
// shared dictionary for reuse in OnboardingYacht / Register /
// TechnicianDashboard.

export const CATEGORIES = [
  { id: 'motore', icon: '⚙️', name: 'Motore & Propulsione', subcategories: ['Guasto/Avaria Motore - EB', 'Guasto/Avaria Motore - FB', 'Guasto/Avaria Motore - EFB', 'Guasto/Avaria Motore - IPS', 'Guasto/Avaria Motore - POD', 'Pezzi di ricambio', 'Tagliando Motore - ORD', 'Tagliando Motore - STR', 'Avaria/Guasto Generatore', 'Tagliando Generatore', 'Elica e asse', 'Piede poppiero', 'Fuoribordo'] },
  { id: 'elettrico', icon: '⚡', name: 'Elettrico & Elettronico', subcategories: ['Impianto elettrico - 12V', 'Impianto elettrico - 24V', 'Impianto elettrico - 220V', 'Impianto elettrico - 380V', 'Quadri elettrici', 'Test isolamento', 'Batterie e caricabatterie', 'Pannelli solari', 'Generatore', 'Luci di navigazione', 'Sostituzione batterie'] },
  { id: 'oleodinamica', icon: '🔩', name: 'Oleodinamica', subcategories: ['Passerella', 'Portelloni', 'Gru', 'Porte automatiche'] },
  { id: 'aria_condizionata', icon: '❄️', name: 'Aria Condizionata', subcategories: ['Compressori', 'Chiller', 'Fan coil', 'Coibentazione', 'Pompe acqua mare', 'Assistenza', 'Vendita', 'Installazione'] },
  { id: 'scafo', icon: '🛥️', name: 'Scafo & Struttura', subcategories: ['Riparazione vetroresina', 'Osmosi', 'Carena', 'Antivegetativa', 'Zinchi anodici', 'Siliconature/Sigillature', 'Smontaggi e rimontaggi', 'Tientibene / Mano rail'] },
  { id: 'coperta', icon: '⚓', name: 'Coperta & Attrezzatura', subcategories: ['Winch e manovre', 'Albero e sartiame', 'Vela e armo', 'Ancora e catena', 'Verricello', 'Bozzelli e carrelli', 'Registrazione portelli'] },
  { id: 'impianti', icon: '🔩', name: 'Impianti di Bordo', subcategories: ['Impianto idrico', 'Impianto gas', 'Impianto acque nere', 'Cucina / fornello', 'Frigorifero / congelatore', 'Riscaldamento', 'Dissalatore', 'WC marino', 'Autoclave'] },
  { id: 'navigazione', icon: '🧭', name: 'Navigazione & Strumentazione', subcategories: ['Chart plotter', 'Radar', 'Autopilota', 'Antenne', 'Dome', 'Starlink', 'GPS', 'VHF', 'AIS', 'EPIRB / MOB'] },
  { id: 'elettrodomestici', icon: '🍳', name: 'Elettrodomestici di Bordo', subcategories: ['Piano cottura', 'Forno', 'Lavastoviglie', 'Frigorifero', 'Fridger', 'Icemaker'] },
  { id: 'stabilizzatori', icon: '⚖️', name: 'Stabilizzatori', subcategories: ['Giroscopici Smartgyro', 'Giroscopici Seakeeper', 'Pinne CMC', 'Pinne Humphree'] },
  { id: 'tappezzeria', icon: '🧵', name: 'Tappezzeria & Tessuti', subcategories: ['Cuscini e cuscinerie', 'Rivestimenti interni', 'Moquette', 'Tendalini e capotte', 'Tende esterne', 'Biancheria bordo', 'Materassi', 'Riparazioni e cuciture'] },
  { id: 'lavaggi', icon: '🧼', name: 'Lavaggi & Pulizia', subcategories: ['Lavaggio esterno', 'Pulizia interna', 'Igienizzazione interna', 'Pulizia sentina', 'Lavaggio teak'] },
  { id: 'vetri', icon: '🔍', name: 'Vetri & Vetrate', subcategories: ['Sostituzione vetri', 'Riparazione vetri', 'Lucidatura vetri', 'Siliconatura / incollaggio', 'Sostituzione parabrezza', 'Realizzazione custom'] },
  { id: 'wrapping', icon: '🎨', name: 'Wrapping & Pellicole', subcategories: ['Wrapping esterno', 'Wrapping interno', 'Pellicola protettiva', 'Nano tecnologie', 'Pellicole vetri / oscuranti', 'Serigrafie'] },
  { id: 'spurghi', icon: '💧', name: 'Spurghi & Alta Pressione', subcategories: ['Spurghi e recupero acque nere', 'Lavaggio casse AN/AG', 'Flussaggio gasolio', 'Lavaggio alta pressione'] },
  { id: 'falegname', icon: '🛠️', name: 'Falegname & Carpentiere', subcategories: ['Lavorazioni teak', 'Lavorazioni interne in legno', 'Manufatti su misura', 'Installazione imbonaggi', 'Calafatura coperta', 'Pavimentazioni interne', 'Supporti alla tappezzeria'] },
  { id: 'idraulico', icon: '🔧', name: 'Idraulico & Tubista', subcategories: ['Ombrinali', 'Pompe alta e bassa pressione', 'Pressfitting', 'Cunipress', 'Multistrato', 'Prese a mare', 'Seacest / cestelli', 'Boiler', 'Autoclave', 'Coibentazione tubi'] },
  { id: 'verniciatore', icon: '🖌️', name: 'Verniciatore & Lucidatore', subcategories: ['Verniciatura gelcoat', 'Verniciatura smalto', 'Verniciatura vetroresina', 'Verniciatura metalli', 'Lucidatura gelcoat', 'Touch-up e ritocchi', 'Verniciatura interna legno', 'Pittore nome nave', 'Nano tecnologie'] },
  { id: 'lavanderia', icon: '👕', name: 'Lavanderia', subcategories: ['Pick-up biancheria', 'Roll-in / Roll-out', 'Lavaggio tappezzerie', 'Lavaggio moquettes'] },
  { id: 'posti_barca', icon: '🅿️', name: 'Posti Barca', subcategories: ['Ormeggio temporaneo', 'Ormeggio stagionale', 'Posto barca annuale', 'Cambio posto', 'Assistenza ormeggio'] },
];

export function getCategoryLabel(slug) {
  const cat = CATEGORIES.find(c => c.id === slug);
  return cat ? cat.name : slug;
}
