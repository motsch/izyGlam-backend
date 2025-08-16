import LanguageModel from "../models/language";
import VilleModel from "../models/ville";


// Liste des villes avec code_postal et nb_habitnts
const villes = [
  // Paris
  { name: '1er', latitude: 48.8626, longitude: 2.3364, pays: "France", city: "Paris", active: true, nb_habitnts: 17000, code_postal: "75001" },
  { name: '2ème', latitude: 48.8682, longitude: 2.3449, pays: "France", city: "Paris", active: true, nb_habitnts: 21000, code_postal: "75002" },
  { name: '3ème', latitude: 48.8635, longitude: 2.36, pays: "France", city: "Paris", active: true, nb_habitnts: 35000, code_postal: "75003" },
  { name: '4ème', latitude: 48.8546, longitude: 2.357, pays: "France", city: "Paris", active: true, nb_habitnts: 28000, code_postal: "75004" },
  { name: '5ème', latitude: 48.8445, longitude: 2.3488, pays: "France", city: "Paris", active: true, nb_habitnts: 60000, code_postal: "75005" },
  { name: '6ème', latitude: 48.8493, longitude: 2.3332, pays: "France", city: "Paris", active: true, nb_habitnts: 45000, code_postal: "75006" },
  { name: '7ème', latitude: 48.8566, longitude: 2.3126, pays: "France", city: "Paris", active: true, nb_habitnts: 50000, code_postal: "75007" },
  { name: '8ème', latitude: 48.8718, longitude: 2.3115, pays: "France", city: "Paris", active: true, nb_habitnts: 40000, code_postal: "75008" },
  { name: '9ème', latitude: 48.8767, longitude: 2.3362, pays: "France", city: "Paris", active: true, nb_habitnts: 60000, code_postal: "75009" },
  { name: '10ème', latitude: 48.8744, longitude: 2.3572, pays: "France", city: "Paris", active: true, nb_habitnts: 90000, code_postal: "75010" },
  { name: '11ème', latitude: 48.8594, longitude: 2.3798, pays: "France", city: "Paris", active: true, nb_habitnts: 150000, code_postal: "75011" },
  { name: '12ème', latitude: 48.8414, longitude: 2.3929, pays: "France", city: "Paris", active: true, nb_habitnts: 110000, code_postal: "75012" },
  { name: '13ème', latitude: 48.8311, longitude: 2.3557, pays: "France", city: "Paris", active: true, nb_habitnts: 180000, code_postal: "75013" },
  { name: '14ème', latitude: 48.8323, longitude: 2.3233, pays: "France", city: "Paris", active: true, nb_habitnts: 140000, code_postal: "75014" },
  { name: '15ème', latitude: 48.8407, longitude: 2.2981, pays: "France", city: "Paris", active: true, nb_habitnts: 230000, code_postal: "75015" },
  { name: '16ème', latitude: 48.862, longitude: 2.2709, pays: "France", city: "Paris", active: true, nb_habitnts: 160000, code_postal: "75016" },
  { name: '17ème', latitude: 48.8848, longitude: 2.3157, pays: "France", city: "Paris", active: true, nb_habitnts: 170000, code_postal: "75017" },
  { name: '18ème', latitude: 48.8924, longitude: 2.3447, pays: "France", city: "Paris", active: true, nb_habitnts: 200000, code_postal: "75018" },
  { name: '19ème', latitude: 48.8847, longitude: 2.3829, pays: "France", city: "Paris", active: true, nb_habitnts: 180000, code_postal: "75019" },
  { name: '20ème', latitude: 48.8635, longitude: 2.3985, pays: "France", city: "Paris", active: true, nb_habitnts: 190000, code_postal: "75020" },

  // { name: 'Londres', latitude: 51.5074, longitude: -0.1278, pays: "England", city: "Londres", active: false, nb_habitnts: 9300000, code_postal: "EC1A 1BB" },
  // { name: 'Berlin', latitude: 52.5200, longitude: 13.4050, pays: "Germany", city: "Berlin", active: false, nb_habitnts: 3700000, code_postal: "10115" },
  // { name: 'Madrid', latitude: 40.4168, longitude: -3.7038, pays: "Spain", city: "Madrid", active: false, nb_habitnts: 3300000, code_postal: "28001" },
  // { name: 'Rome', latitude: 41.9028, longitude: 12.4964, pays: "Italy", city: "Rome", active: false, nb_habitnts: 2870000, code_postal: "00184" },
  // Berlin (codes postaux fictifs, adapte si besoin)
  { name: 'Mitte', latitude: 52.52, longitude: 13.405, pays: "Germany", city: "Berlin", code_postal: "10115", nb_habitnts: 190000, active: false },
  { name: 'Friedrichshain-Kreuzberg', latitude: 52.5101, longitude: 13.426, pays: "Germany", city: "Berlin", code_postal: "10243", nb_habitnts: 190000, active: false },
  { name: 'Pankow', latitude: 52.576, longitude: 13.411, pays: "Germany", city: "Berlin", code_postal: "13187", nb_habitnts: 190000, active: false },
  { name: 'Charlottenburg-Wilmersdorf', latitude: 52.5163, longitude: 13.3041, pays: "Germany", city: "Berlin", code_postal: "14059", nb_habitnts: 190000, active: false },
  { name: 'Spandau', latitude: 52.5342, longitude: 13.1996, pays: "Germany", city: "Berlin", code_postal: "13503", nb_habitnts: 190000, active: false },

  // Londres (codes postaux fictifs)
  { name: 'Westminster', latitude: 51.4995, longitude: -0.1357, pays: "England", city: "Londres", code_postal: "SW1A 1AA", nb_habitnts: 190000, active: false },
  { name: 'Camden', latitude: 51.529, longitude: -0.1255, pays: "England", city: "Londres", code_postal: "NW3 2QA", nb_habitnts: 190000, active: false },
  { name: 'Kensington', latitude: 51.501, longitude: -0.1936, pays: "England", city: "Londres", code_postal: "W8 5SA", nb_habitnts: 190000, active: false },
  { name: 'Chelsea', latitude: 51.4875, longitude: -0.1682, pays: "England", city: "Londres", code_postal: "SW3 3RR", nb_habitnts: 190000, active: false },
  { name: 'Greenwich', latitude: 51.4821, longitude: -0.0057, pays: "England", city: "Londres", code_postal: "SE10 9NF", nb_habitnts: 190000, active: false },

  // Madrid (codes postaux fictifs)
  { name: 'Centro', latitude: 40.4165, longitude: -3.7036, pays: "Spain", city: "Madrid", code_postal: "28001", nb_habitnts: 190000, active: false },
  { name: 'Arganzuela', latitude: 40.398, longitude: -3.6944, pays: "Spain", city: "Madrid", code_postal: "28045", nb_habitnts: 190000, active: false },
  { name: 'Retiro', latitude: 40.4136, longitude: -3.6818, pays: "Spain", city: "Madrid", code_postal: "28012", nb_habitnts: 190000, active: false },
  { name: 'Salamanca', latitude: 40.4259, longitude: -3.6842, pays: "Spain", city: "Madrid", code_postal: "28006", nb_habitnts: 190000, active: false },
  { name: 'Chamartín', latitude: 40.458, longitude: -3.6889, pays: "Spain", city: "Madrid", code_postal: "28020", nb_habitnts: 190000, active: false },

  // Rome (codes postaux fictifs)
  { name: 'Municipio I', latitude: 41.9009, longitude: 12.4833, pays: "Italy", city: "Rome", code_postal: "00184", nb_habitnts: 190000, active: false },
  { name: 'Municipio II', latitude: 41.913, longitude: 12.4907, pays: "Italy", city: "Rome", code_postal: "00185", nb_habitnts: 190000, active: false },
  { name: 'Municipio III', latitude: 41.961, longitude: 12.5432, pays: "Italy", city: "Rome", code_postal: "00186", nb_habitnts: 190000, active: false },
  { name: 'Municipio IV', latitude: 41.9259, longitude: 12.568, pays: "Italy", city: "Rome", code_postal: "00187", nb_habitnts: 190000, active: false },
  { name: 'Municipio V', latitude: 41.8947, longitude: 12.5306, pays: "Italy", city: "Rome", code_postal: "00188", nb_habitnts: 190000, active: false },

  // Villes européennes les plus peuplées (active: false)
  { name: 'Istanbul', latitude: 41.0082, longitude: 28.9784, pays: "Turkey", city: "Istanbul", active: false, nb_habitnts: 15520000, code_postal: "34000" },
  { name: 'Kyiv', latitude: 50.4501, longitude: 30.5234, pays: "Ukraine", city: "Kyiv", active: false, nb_habitnts: 2800000, code_postal: "01001" },
  { name: 'Bucharest', latitude: 44.4268, longitude: 26.1025, pays: "Romania", city: "Bucharest", active: false, nb_habitnts: 1830000, code_postal: "010011" },
  { name: 'Minsk', latitude: 53.9000, longitude: 27.5667, pays: "Belarus", city: "Minsk", active: false, nb_habitnts: 2000000, code_postal: "220030" },
  { name: 'Vienne', latitude: 48.2082, longitude: 16.3738, pays: "Austria", city: "Vienne", active: false, nb_habitnts: 1900000, code_postal: "1010" },
  { name: 'Hambourg', latitude: 53.5511, longitude: 9.9937, pays: "Germany", city: "Hambourg", active: false, nb_habitnts: 1800000, code_postal: "20095" },
  { name: 'Varsovie', latitude: 52.2297, longitude: 21.0122, pays: "Poland", city: "Varsovie", active: false, nb_habitnts: 1780000, code_postal: "00-001" },
  { name: 'Barcelone', latitude: 41.3851, longitude: 2.1734, pays: "Spain", city: "Barcelone", active: false, nb_habitnts: 1620000, code_postal: "08001" },
  { name: 'Munich', latitude: 48.1351, longitude: 11.5820, pays: "Germany", city: "Munich", active: false, nb_habitnts: 1470000, code_postal: "80331" },
  { name: 'Milan', latitude: 45.4642, longitude: 9.1900, pays: "Italy", city: "Milan", active: false, nb_habitnts: 1350000, code_postal: "20121" },
  { name: 'Prague', latitude: 50.0755, longitude: 14.4378, pays: "Czech Republic", city: "Prague", active: false, nb_habitnts: 1300000, code_postal: "110 00" },
  { name: 'Sofia', latitude: 42.6977, longitude: 23.3219, pays: "Bulgaria", city: "Sofia", active: false, nb_habitnts: 1240000, code_postal: "1000" },
  { name: 'Bruxelles', latitude: 50.8503, longitude: 4.3517, pays: "Belgium", city: "Bruxelles", active: false, nb_habitnts: 1200000, code_postal: "1000" },
  { name: 'Birmingham', latitude: 52.4862, longitude: -1.8904, pays: "England", city: "Birmingham", active: false, nb_habitnts: 1100000, code_postal: "B1 1AA" },
  { name: 'Naples', latitude: 40.8518, longitude: 14.2681, pays: "Italy", city: "Naples", active: false, nb_habitnts: 970000, code_postal: "80100" },
  { name: 'Turin', latitude: 45.0703, longitude: 7.6869, pays: "Italy", city: "Turin", active: false, nb_habitnts: 870000, code_postal: "10100" },
  { name: 'Stockholm', latitude: 59.3293, longitude: 18.0686, pays: "Sweden", city: "Stockholm", active: false, nb_habitnts: 975000, code_postal: "111 21" },
  { name: 'Amsterdam', latitude: 52.3676, longitude: 4.9041, pays: "Netherlands", city: "Amsterdam", active: false, nb_habitnts: 870000, code_postal: "1012" },
  { name: 'Zagreb', latitude: 45.8150, longitude: 15.9819, pays: "Croatia", city: "Zagreb", active: false, nb_habitnts: 800000, code_postal: "10000" },
  { name: 'Belgrade', latitude: 44.7866, longitude: 20.4489, pays: "Serbia", city: "Belgrade", active: false, nb_habitnts: 1230000, code_postal: "11000" },
  { name: 'Cologne', latitude: 50.9375, longitude: 6.9603, pays: "Germany", city: "Cologne", active: false, nb_habitnts: 1080000, code_postal: "50667" },
  { name: 'Lisbonne', latitude: 38.7223, longitude: -9.1393, pays: "Portugal", city: "Lisbonne", active: false, nb_habitnts: 545000, code_postal: "1100-001" },
  { name: 'Valence', latitude: 39.4699, longitude: -0.3763, pays: "Spain", city: "Valence", active: false, nb_habitnts: 800000, code_postal: "46001" },
  { name: 'Séville', latitude: 37.3891, longitude: -5.9845, pays: "Spain", city: "Séville", active: false, nb_habitnts: 700000, code_postal: "41001" },
  { name: 'Dortmund', latitude: 51.5136, longitude: 7.4653, pays: "Germany", city: "Dortmund", active: false, nb_habitnts: 600000, code_postal: "44135" },
  { name: 'Essen', latitude: 51.4556, longitude: 7.0116, pays: "Germany", city: "Essen", active: false, nb_habitnts: 580000, code_postal: "45127" },
  { name: 'Düsseldorf', latitude: 51.2277, longitude: 6.7735, pays: "Germany", city: "Düsseldorf", active: false, nb_habitnts: 610000, code_postal: "40210" },
  { name: 'Francfort', latitude: 50.1109, longitude: 8.6821, pays: "Germany", city: "Francfort", active: false, nb_habitnts: 750000, code_postal: "60311" },
  { name: 'Stuttgart', latitude: 48.7758, longitude: 9.1829, pays: "Germany", city: "Stuttgart", active: false, nb_habitnts: 630000, code_postal: "70173" },
  { name: 'Leipzig', latitude: 51.3397, longitude: 12.3731, pays: "Germany", city: "Leipzig", active: false, nb_habitnts: 600000, code_postal: "04109" },
  { name: 'Dresde', latitude: 51.0504, longitude: 13.7373, pays: "Germany", city: "Dresde", active: false, nb_habitnts: 550000, code_postal: "01067" },
  { name: 'Porto', latitude: 41.1579, longitude: -8.6291, pays: "Portugal", city: "Porto", active: false, nb_habitnts: 240000, code_postal: "4000-001" },
  { name: 'Wroclaw', latitude: 51.1079, longitude: 17.0385, pays: "Poland", city: "Wroclaw", active: false, nb_habitnts: 640000, code_postal: "50-001" },
  { name: 'Cracovie', latitude: 50.0647, longitude: 19.9450, pays: "Poland", city: "Cracovie", active: false, nb_habitnts: 780000, code_postal: "30-001" },
  { name: 'Lviv', latitude: 49.8397, longitude: 24.0297, pays: "Ukraine", city: "Lviv", active: false, nb_habitnts: 720000, code_postal: "79000" },
  { name: 'Bari', latitude: 41.1171, longitude: 16.8719, pays: "Italy", city: "Bari", active: false, nb_habitnts: 320000, code_postal: "70121" },
  { name: 'Vérone', latitude: 45.4384, longitude: 10.9916, pays: "Italy", city: "Vérone", active: false, nb_habitnts: 260000, code_postal: "37121" },
  { name: 'Gênes', latitude: 44.4056, longitude: 8.9463, pays: "Italy", city: "Gênes", active: false, nb_habitnts: 580000, code_postal: "16121" },
  { name: 'Florence', latitude: 43.7696, longitude: 11.2558, pays: "Italy", city: "Florence", active: false, nb_habitnts: 380000, code_postal: "50122" },
  { name: 'Palermo', latitude: 38.1157, longitude: 13.3615, pays: "Italy", city: "Palermo", active: false, nb_habitnts: 670000, code_postal: "90100" },
  { name: 'Catane', latitude: 37.5079, longitude: 15.0830, pays: "Italy", city: "Catane", active: false, nb_habitnts: 310000, code_postal: "95100" },
  { name: 'Thessalonique', latitude: 40.6401, longitude: 22.9444, pays: "Greece", city: "Thessalonique", active: false, nb_habitnts: 315000, code_postal: "546 21" },
  { name: 'Athènes', latitude: 37.9838, longitude: 23.7275, pays: "Greece", city: "Athènes", active: false, nb_habitnts: 664000, code_postal: "105 52" },
  { name: 'Nuremberg', latitude: 49.4521, longitude: 11.0767, pays: "Germany", city: "Nuremberg", active: false, nb_habitnts: 520000, code_postal: "90402" },
  { name: 'Duisbourg', latitude: 51.4344, longitude: 6.7623, pays: "Germany", city: "Duisbourg", active: false, nb_habitnts: 500000, code_postal: "47051" },
  { name: 'Bochum', latitude: 51.4818, longitude: 7.2162, pays: "Germany", city: "Bochum", active: false, nb_habitnts: 365000, code_postal: "44787" },
  { name: 'Wuppertal', latitude: 51.2562, longitude: 7.1508, pays: "Germany", city: "Wuppertal", active: false, nb_habitnts: 350000, code_postal: "42103" },
  { name: 'Hanovre', latitude: 52.3705, longitude: 9.7332, pays: "Germany", city: "Hanovre", active: false, nb_habitnts: 530000, code_postal: "30159" },
  { name: 'Brême', latitude: 53.0793, longitude: 8.8017, pays: "Germany", city: "Brême", active: false, nb_habitnts: 570000, code_postal: "28195" },
  { name: 'Poznań', latitude: 52.4064, longitude: 16.9252, pays: "Poland", city: "Poznań", active: false, nb_habitnts: 540000, code_postal: "60-101" },
  { name: 'Gdańsk', latitude: 54.3520, longitude: 18.6466, pays: "Poland", city: "Gdańsk", active: false, nb_habitnts: 470000, code_postal: "80-001" },
  { name: 'Bologne', latitude: 44.4949, longitude: 11.3426, pays: "Italy", city: "Bologne", active: false, nb_habitnts: 390000, code_postal: "40121" },
  { name: 'Saragosse', latitude: 41.6488, longitude: -0.8891, pays: "Spain", city: "Saragosse", active: false, nb_habitnts: 675000, code_postal: "50001" },
  { name: 'Malaga', latitude: 36.7213, longitude: -4.4214, pays: "Spain", city: "Malaga", active: false, nb_habitnts: 570000, code_postal: "29001" },
  { name: 'Marseille', latitude: 43.2965, longitude: 5.3698, pays: "France", city: "Marseille", active: false, nb_habitnts: 860000, code_postal: "13001" },
  { name: 'Lyon', latitude: 45.7640, longitude: 4.8357, pays: "France", city: "Lyon", active: false, nb_habitnts: 515000, code_postal: "69001" },
  { name: 'Toulouse', latitude: 43.6047, longitude: 1.4442, pays: "France", city: "Toulouse", active: false, nb_habitnts: 480000, code_postal: "31000" },
  { name: 'Glasgow', latitude: 55.8642, longitude: -4.2518, pays: "Scotland", city: "Glasgow", active: false, nb_habitnts: 600000, code_postal: "G1 1XX" },
  { name: 'Liverpool', latitude: 53.4084, longitude: -2.9916, pays: "England", city: "Liverpool", active: false, nb_habitnts: 500000, code_postal: "L1 8JQ" },
  { name: 'Cluj-Napoca', latitude: 46.7712, longitude: 23.6236, pays: "Romania", city: "Cluj-Napoca", active: false, nb_habitnts: 320000, code_postal: "400001" },
  { name: 'Timișoara', latitude: 45.7489, longitude: 21.2087, pays: "Romania", city: "Timișoara", active: false, nb_habitnts: 320000, code_postal: "300001" },
  { name: 'Izmir', latitude: 38.4237, longitude: 27.1428, pays: "Turkey", city: "Izmir", active: false, nb_habitnts: 3900000, code_postal: "35000" },
  { name: 'Patras', latitude: 38.2466, longitude: 21.7346, pays: "Greece", city: "Patras", active: false, nb_habitnts: 170000, code_postal: "25100" },
  { name: 'Zurich', latitude: 47.3769, longitude: 8.5417, pays: "Switzerland", city: "Zurich", active: false, nb_habitnts: 430000, code_postal: "8001" },
  { name: 'Budapest', latitude: 47.4979, longitude: 19.0402, pays: "Hungary", city: "Budapest", active: false, nb_habitnts: 1750000, code_postal: "1051" },
  { name: 'Copenhague', latitude: 55.6761, longitude: 12.5683, pays: "Denmark", city: "Copenhague", active: false, nb_habitnts: 800000, code_postal: "DK-1000" },
  { name: 'Oslo', latitude: 59.9139, longitude: 10.7522, pays: "Norway", city: "Oslo", active: false, nb_habitnts: 670000, code_postal: "0150" },
  { name: 'Helsinki', latitude: 60.1699, longitude: 24.9384, pays: "Finland", city: "Helsinki", active: false, nb_habitnts: 655000, code_postal: "00100" },
  { name: 'Kharkiv', latitude: 49.9935, longitude: 36.2304, pays: "Ukraine", city: "Kharkiv", active: false, nb_habitnts: 1400000, code_postal: "61000" },
  { name: 'Odessa', latitude: 46.4825, longitude: 30.7233, pays: "Ukraine", city: "Odessa", active: false, nb_habitnts: 1020000, code_postal: "65000" },
  { name: 'Anvers', latitude: 51.2194, longitude: 4.4025, pays: "Belgium", city: "Anvers", active: false, nb_habitnts: 520000, code_postal: "2000" },
  { name: 'Gand', latitude: 51.0543, longitude: 3.7174, pays: "Belgium", city: "Gand", active: false, nb_habitnts: 260000, code_postal: "9000" },
  { name: 'Nice', latitude: 43.7102, longitude: 7.2620, pays: "France", city: "Nice", active: false, nb_habitnts: 340000, code_postal: "06000" },
  { name: 'Nantes', latitude: 47.2184, longitude: -1.5536, pays: "France", city: "Nantes", active: false, nb_habitnts: 310000, code_postal: "44000" },
  { name: 'Mönchengladbach', latitude: 51.1805, longitude: 6.4413, pays: "Germany", city: "Mönchengladbach", active: false, nb_habitnts: 260000, code_postal: "41063" },
  { name: 'Murcia', latitude: 37.9922, longitude: -1.1307, pays: "Spain", city: "Murcia", active: false, nb_habitnts: 450000, code_postal: "30001" },
  { name: 'Padoue', latitude: 45.4064, longitude: 11.8768, pays: "Italy", city: "Padoue", active: false, nb_habitnts: 210000, code_postal: "35100" },
  { name: 'Sheffield', latitude: 53.3811, longitude: -1.4701, pays: "England", city: "Sheffield", active: false, nb_habitnts: 582000, code_postal: "S1 2HH" },
  { name: 'Leeds', latitude: 53.8008, longitude: -1.5491, pays: "England", city: "Leeds", active: false, nb_habitnts: 789000, code_postal: "LS1 4DY" },
  { name: 'Bordeaux', latitude: 44.8378, longitude: -0.5792, pays: "France", city: "Bordeaux", active: false, nb_habitnts: 250000, code_postal: "33000" },
  { name: 'Bursa', latitude: 40.1828, longitude: 29.0665, pays: "Turkey", city: "Bursa", active: false, nb_habitnts: 3000000, code_postal: "16000" },
  { name: 'Lublin', latitude: 51.2465, longitude: 22.5684, pays: "Poland", city: "Lublin", active: false, nb_habitnts: 340000, code_postal: "20-001" },
  { name: 'Iași', latitude: 47.1585, longitude: 27.6014, pays: "Romania", city: "Iași", active: false, nb_habitnts: 320000, code_postal: "700000" },
  { name: 'Novi Sad', latitude: 45.2671, longitude: 19.8335, pays: "Serbia", city: "Novi Sad", active: false, nb_habitnts: 250000, code_postal: "21000" },
  { name: 'Dnipro', latitude: 48.4647, longitude: 35.0462, pays: "Ukraine", city: "Dnipro", active: false, nb_habitnts: 990000, code_postal: "49000" },
  { name: 'Tarente', latitude: 40.4644, longitude: 17.2470, pays: "Italy", city: "Tarente", active: false, nb_habitnts: 200000, code_postal: "74100" },
  { name: 'Karlsruhe', latitude: 49.0069, longitude: 8.4037, pays: "Germany", city: "Karlsruhe", active: false, nb_habitnts: 315000, code_postal: "76131" },
  { name: 'Mannheim', latitude: 49.4875, longitude: 8.4660, pays: "Germany", city: "Mannheim", active: false, nb_habitnts: 310000, code_postal: "68159" },
  { name: 'Lille', latitude: 50.6292, longitude: 3.0573, pays: "France", city: "Lille", active: false, nb_habitnts: 232000, code_postal: "59000" },
  { name: 'Bilbao', latitude: 43.2630, longitude: -2.9350, pays: "Spain", city: "Bilbao", active: false, nb_habitnts: 345000, code_postal: "48001" },
  { name: 'Augsbourg', latitude: 48.3705, longitude: 10.8978, pays: "Germany", city: "Augsbourg", active: false, nb_habitnts: 295000, code_postal: "86150" },
  { name: 'Brescia', latitude: 45.5416, longitude: 10.2118, pays: "Italy", city: "Brescia", active: false, nb_habitnts: 196000, code_postal: "25121" }
];


const langues = [
  { code: 'fr', name: 'Français', flag: '/assets/flags/fr.png', trad: "LANGUE.FRANCAIS", active: true }, // Français
  { code: 'de', name: 'Allemand', flag: '/assets/flags/de.png', trad: "LANGUE.ALLEMAND", active: false }, // Allemand
  { code: 'en', name: 'Anglais', flag: '/assets/flags/gb.png', trad: "LANGUE.ANGLAIS", active: false }, // Anglais
  { code: 'es', name: 'Espagnol', flag: '/assets/flags/es.png', trad: "LANGUE.ESPAGNOL", active: false }, // Espagnol
  { code: 'fi', name: 'Finlandais', flag: '/assets/flags/fi.png', trad: "LANGUE.FINLANDAIS", active: false }, // Finlandais
  { code: 'it', name: 'Italien', flag: '/assets/flags/it.png', trad: "LANGUE.ITALIEN", active: false }, // Italien
  { code: 'nl', name: 'Néerlandais', flag: '/assets/flags/nl.png', trad: "LANGUE.NEERLANDAIS", active: false }, // Néerlandais
  { code: 'pl', name: 'Polonais', flag: '/assets/flags/pl.png', trad: "LANGUE.POLONAIS", active: false }, // Polonais
  { code: 'pt', name: 'Portugais', flag: '/assets/flags/pt.png', trad: "LANGUE.PORTUGAIS", active: false }, // Portugais
  { code: 'sv', name: 'Suédois', flag: '/assets/flags/sv.png', trad: "LANGUE.SUEDOIS", active: false }, // Suédois
  { code: 'da', name: 'Danois', flag: '/assets/flags/da.png', trad: "LANGUE.DANOIS", active: false }, // Danois
];


export const seedDatabase = async () => {
  try {
    // Vérification et injection des villes
    const villeCount = await VilleModel.countDocuments();
    if (villeCount === 0) {
      await VilleModel.insertMany(villes);
      console.log("Les villes ont été insérées avec succès");
    } else {
      console.log("Les villes existent déjà");
    }
  } catch (error) {
    console.error("Erreur lors du seed :", error);
  }
  try {
    // Vérification et injection des villes
    const langueCount = await LanguageModel.countDocuments();
    if (langueCount === 0) {
      await LanguageModel.insertMany(langues);
      console.log("Les langues ont été insérées avec succès");
    } else {
      console.log("Les langues existent déjà");
    }
  } catch (error) {
    console.error("Erreur lors du seed :", error);
  }
};
