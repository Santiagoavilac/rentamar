export type Experience = {
  id: string;
  image: string;
  label: string;
  phrase: string;
  description: string;
  alt: string;
};

export const experiences: Experience[] = [
  {
    id: "padel",
    image: "/media/canchas/canchapadel1.JPG.jpeg",
    label: "Pádel",
    phrase: "Viví una experiencia jugando pádel",
    description: "Canchas listas a pasos del alojamiento.",
    alt: "Cancha de pádel en Mar Adentro",
  },
  {
    id: "surf",
    image: "/media/amenidades/Surfderemos.jpg",
    label: "Surf de remo",
    phrase: "Viví una experiencia sobre el agua",
    description: "Salí a remar apenas te levantás.",
    alt: "Surf de remo en la laguna",
  },
  {
    id: "gastronomia",
    image: "/media/amenidades/bahia.png",
    label: "Gastronomía",
    phrase: "Sabores frente al agua",
    description: "El Restaurante Bahía, a pocos pasos.",
    alt: "Restaurante Bahía en Mar Adentro",
  },
  {
    id: "familia",
    image: "/media/playa/familia.png",
    label: "En familia",
    phrase: "Momentos frente a la laguna",
    description: "Muelles y agua tranquila para toda la familia.",
    alt: "Familia sentada en el muelle frente a la laguna",
  },
  {
    id: "descanso",
    image: "/media/amenidades/tikibar.jpg",
    label: "Descanso",
    phrase: "Relax a la sombra junto al agua",
    description: "Reposeras y palapas al borde de la laguna.",
    alt: "Mujer descansando bajo una palapa junto a la laguna",
  },
  {
    id: "playa",
    image: "/media/playa/modelo.png",
    label: "Playa",
    phrase: "Atardeceres en la arena",
    description: "Tardes de sol a la orilla del agua.",
    alt: "Tarde de playa en la arena al atardecer",
  },
  {
    id: "tikibar",
    image: "/media/amenidades/tikibar.png",
    label: "Tiki bar",
    phrase: "Tragos en el tiki bar",
    description: "Cócteles de autor frente al agua.",
    alt: "Trago servido en vaso tiki en el bar",
  },
];
