import { PartyChecklistItem } from '../types';

export const DEFAULT_PARTY_CHECKLIST: PartyChecklistItem[] = [
  // Som & Áudio
  { id: 'item_sound_box', label: 'Caixa de som amplificada + Cabo de energia', checked: false, category: 'audio' },
  { id: 'item_microphones', label: 'Microfones sem fio + Pilhas reservas', checked: false, category: 'audio' },
  { id: 'item_sound_cable', label: 'Cabo auxiliar / Conexão Bluetooth testada', checked: false, category: 'audio' },

  // Pintura Facial & Artes
  { id: 'item_face_paint', label: 'Estojo de tintas faciais antialérgicas', checked: false, category: 'painting' },
  { id: 'item_brushes', label: 'Pincéis higienizados e esponjas', checked: false, category: 'painting' },
  { id: 'item_glitter', label: 'Glitter em gel / pó biodegradável', checked: false, category: 'painting' },
  { id: 'item_wipes_mirror', label: 'Lenços umedecidos e espelho de mão', checked: false, category: 'painting' },

  // Dinâmicas & Jogos
  { id: 'item_vests', label: 'Coletes coloridos para divisão de equipes', checked: false, category: 'games' },
  { id: 'item_tug_rope', label: 'Corda resistente para cabo de guerra', checked: false, category: 'games' },
  { id: 'item_parachute', label: 'Paraquedas lúdico gigante', checked: false, category: 'games' },
  { id: 'item_balls_cones', label: 'Bolas esportivas e cones de sinalização', checked: false, category: 'games' },

  // Balões & Oficinas
  { id: 'item_balloon_pump', label: 'Bomba manual de inflar bexigas', checked: false, category: 'workshops' },
  { id: 'item_balloons_260', label: 'Pacote de bexigas canudo 260 para esculturas', checked: false, category: 'workshops' },
  { id: 'item_slime_kit', label: 'Kit de oficina (cola, ativador, corantes - se contratado)', checked: false, category: 'workshops' },
];

export const STANDARD_PARTY_SERVICES: string[] = [
  'Recreação Completa',
  'Pintura Facial Artística',
  'Escultura em Balões',
  'Oficina de Slime',
  'Baladinha Neon / Som',
  'Caça ao Tesouro Temática',
  'Gincana Esportiva / Molhada',
  'Tatuagem Temporária',
  'Oficina de Artesanato',
  'Personagem / Mascote',
];

export const STANDARD_EVENT_TYPES: string[] = [
  'Aniversário Infantil',
  'Festa Temática',
  'Casamento / Espaço Kids',
  'Evento Corporativo',
  'Festa Escolar',
  'Chá Revelação / Batizado',
  'Condomínio / Clube',
  'Outro',
];
