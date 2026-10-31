export interface PodcastCategory {
  id: string;
  name: string;
  query: string;
  colorFrom: string;
  colorTo: string;
  description: string;
}

export const PODCAST_CATEGORIES: PodcastCategory[] = [
  {
    id: 'noticias',
    name: 'Notícias & Atualidades',
    query: 'noticias brasil',
    colorFrom: '#1e3c72',
    colorTo: '#2a5298',
    description: 'Os principais fatos do dia, análises e política'
  },
  {
    id: 'comedia',
    name: 'Comédia & Conversa',
    query: 'comedia humor',
    colorFrom: '#d35400',
    colorTo: '#e67e22',
    description: 'Entrevistas descontraídas e bom humor'
  },
  {
    id: 'tecnologia',
    name: 'Tecnologia & Inovação',
    query: 'tecnologia programacao',
    colorFrom: '#0082c8',
    colorTo: '#00c6ff',
    description: 'O futuro digital, inteligência artificial e startups'
  },
  {
    id: 'crimes',
    name: 'Crimes Reais & Mistério',
    query: 'crimes reais investigacao',
    colorFrom: '#6a097d',
    colorTo: '#c06c84',
    description: 'Casos marcantes, investigações e enigmas'
  },
  {
    id: 'cultura',
    name: 'Cultura & Sociedade',
    query: 'cultura sociedade',
    colorFrom: '#8e2de2',
    colorTo: '#4a00e0',
    description: 'Música, cinema, comportamento e histórias humanas'
  },
  {
    id: 'negocios',
    name: 'Negócios & Finanças',
    query: 'negocios financas',
    colorFrom: '#11998e',
    colorTo: '#38ef7d',
    description: 'Mercado financeiro, investimentos e carreira'
  },
  {
    id: 'saude',
    name: 'Saúde & Autoconhecimento',
    query: 'saude autoconhecimento',
    colorFrom: '#d94b72',
    colorTo: '#f5af19',
    description: 'Bem-estar físico e mental para o dia a dia'
  },
  {
    id: 'esportes',
    name: 'Esportes & Futebol',
    query: 'esportes futebol',
    colorFrom: '#0f9b0f',
    colorTo: '#000000',
    description: 'Tudo sobre futebol nacional, debates e resultados'
  },
  {
    id: 'ciencia',
    name: 'Ciência & Educação',
    query: 'ciencia historia',
    colorFrom: '#4776e6',
    colorTo: '#8e54e9',
    description: 'Curiosidades científicas e fatos históricos'
  }
];

/** Featured popular podcast shows in Brazil with reliable feeds */
export const FEATURED_SHOW_SEEDS = [
  {
    id: '1502847920',
    title: 'FATOS DO DIA CNN',
    author: 'CNN Brasil',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/c5/16/de/c516def6-1919-edb3-26a2-e629712474e9/mza_1860424666278322801.jpg/600x600bb.jpg'
  },
  {
    id: '1582015099',
    title: 'Boletim Folha',
    author: 'Folha de S.Paulo',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/2d/0f/4f/2d0f4f0e-f7f4-9823-bcbd-2f314d411795/mza_7003418838553376207.jpg/600x600bb.jpg'
  },
  {
    id: '1477759882',
    title: 'O Assunto',
    author: 'G1',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/ce/68/76/ce6876c4-b7c8-71bf-9ef8-e8cb9b6bf34d/mza_3884351052102554763.jpg/600x600bb.jpg'
  },
  {
    id: '141011409',
    title: 'NerdCast',
    author: 'Jovem Nerd',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/08/90/a1/0890a12e-15d2-0683-1628-94ae6908e063/mza_8367919864276706987.jpg/600x600bb.jpg'
  },
  {
    id: '1538622143',
    title: 'Podpah',
    author: 'Podpah',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/05/cf/84/05cf8405-b1a9-3ce1-e737-14e9f733f81e/mza_12239459392288358487.jpg/600x600bb.jpg'
  },
  {
    id: '1585863339',
    title: 'Mano a Mano',
    author: 'Mano Brown',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/4a/c7/ee/4ac7ee7c-c46d-926c-d2c6-a67b45041ff9/mza_3990666012461426466.jpg/600x600bb.jpg'
  },
  {
    id: '1493630654',
    title: 'Flow Podcast',
    author: 'Estúdios Flow',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/7e/17/30/7e173003-9ef2-50d7-21a4-b0db4b20a4d5/mza_1495146522303038670.jpg/600x600bb.jpg'
  },
  {
    id: '1504954784',
    title: 'Modus Operandi',
    author: 'Mabê Bonafé e Carol Moreira',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/30/1e/8c/301e8c07-2856-74d3-0ec3-0f4db239aa8e/mza_5431637500592965352.jpg/600x600bb.jpg'
  }
];
