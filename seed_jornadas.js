const admin = require('firebase-admin');
const path = require('path');

// Carga la clave de servicio que descargaste de Firebase Console
// → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'porra-udlp-2026-v2'
});

const db = admin.firestore();

const JORNADAS = [
  { n:1,  local:'UD Las Palmas', visitante:'Albacete Balompié',     fecha:'2026-08-16', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:2,  local:'AD Ceuta FC',   visitante:'UD Las Palmas',         fecha:'2026-08-23', estadio:'Estadio Alfonso Murube', esLocal:false },
  { n:3,  local:'Girona FC',     visitante:'UD Las Palmas',         fecha:'2026-08-30', estadio:'Estadio Municipal de Montilivi', esLocal:false },
  { n:4,  local:'UD Las Palmas', visitante:'CD Leganés',            fecha:'2026-09-06', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:5,  local:'Cádiz CF',      visitante:'UD Las Palmas',         fecha:'2026-09-13', estadio:'Estadio Nuevo Mirandilla', esLocal:false },
  { n:6,  local:'UD Las Palmas', visitante:'Burgos CF',             fecha:'2026-09-20', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:7,  local:'SD Eibar',      visitante:'UD Las Palmas',         fecha:'2026-09-27', estadio:'Estadio de Ipurua', esLocal:false },
  { n:8,  local:'UD Las Palmas', visitante:'Real Valladolid CF',    fecha:'2026-10-04', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:9,  local:'RCD Mallorca',  visitante:'UD Las Palmas',         fecha:'2026-10-11', estadio:'Estadi Mallorca Son Moix', esLocal:false },
  { n:10, local:'UD Las Palmas', visitante:'CD Castellón',          fecha:'2026-10-18', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:11, local:'UD Las Palmas', visitante:'Real Sociedad B',       fecha:'2026-10-25', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:12, local:'Real Oviedo',   visitante:'UD Las Palmas',         fecha:'2026-11-01', estadio:'Estadio Carlos Tartiere', esLocal:false },
  { n:13, local:'UD Las Palmas', visitante:'CD Eldense',            fecha:'2026-11-08', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:14, local:'Granada CF',    visitante:'UD Las Palmas',         fecha:'2026-11-15', estadio:'Nuevo Los Cármenes', esLocal:false },
  { n:15, local:'Real Sporting', visitante:'UD Las Palmas',         fecha:'2026-11-22', estadio:'El Molinón', esLocal:false },
  { n:16, local:'UD Las Palmas', visitante:'FC Andorra',            fecha:'2026-11-29', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:17, local:'Córdoba CF',    visitante:'UD Las Palmas',         fecha:'2026-12-06', estadio:'Nuevo Arcángel', esLocal:false },
  { n:18, local:'UD Las Palmas', visitante:'RC Celta Fortuna',      fecha:'2026-12-13', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:19, local:'CE Sabadell',   visitante:'UD Las Palmas',         fecha:'2026-12-20', estadio:'Nova Creu Alta', esLocal:false },
  { n:20, local:'UD Las Palmas', visitante:'CD Tenerife',           fecha:'2027-01-03', estadio:'Estadio de Gran Canaria', esLocal:true, derbi:true },
  { n:21, local:'UD Almería',    visitante:'UD Las Palmas',         fecha:'2027-01-10', estadio:'UD Almería Stadium', esLocal:false },
  { n:22, local:'UD Las Palmas', visitante:'Girona FC',             fecha:'2027-01-17', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:23, local:'Real Sociedad B', visitante:'UD Las Palmas',       fecha:'2027-01-24', estadio:'Instalaciones de Zubieta', esLocal:false },
  { n:24, local:'UD Las Palmas', visitante:'Real Sporting',         fecha:'2027-01-31', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:25, local:'CD Castellón',  visitante:'UD Las Palmas',         fecha:'2027-02-07', estadio:'SkyFi Castalia', esLocal:false },
  { n:26, local:'UD Las Palmas', visitante:'SD Eibar',              fecha:'2027-02-14', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:27, local:'RC Celta Fortuna', visitante:'UD Las Palmas',      fecha:'2027-02-21', estadio:'Municipal de Barreiro', esLocal:false },
  { n:28, local:'UD Las Palmas', visitante:'CE Sabadell',           fecha:'2027-02-28', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:29, local:'UD Las Palmas', visitante:'Granada CF',            fecha:'2027-03-07', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:30, local:'Albacete Balompié', visitante:'UD Las Palmas',     fecha:'2027-03-14', estadio:'Carlos Belmonte', esLocal:false },
  { n:31, local:'UD Las Palmas', visitante:'Real Oviedo',           fecha:'2027-03-21', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:32, local:'CD Tenerife',   visitante:'UD Las Palmas',         fecha:'2027-03-28', estadio:'Heliodoro Rodríguez López', esLocal:false, derbi:true },
  { n:33, local:'UD Las Palmas', visitante:'AD Ceuta FC',           fecha:'2027-04-04', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:34, local:'UD Las Palmas', visitante:'RCD Mallorca',          fecha:'2027-04-11', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:35, local:'CD Leganés',    visitante:'UD Las Palmas',         fecha:'2027-04-18', estadio:'Butarque', esLocal:false },
  { n:36, local:'UD Las Palmas', visitante:'Cádiz CF',              fecha:'2027-04-25', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:37, local:'FC Andorra',    visitante:'UD Las Palmas',         fecha:'2027-05-02', estadio:'Estadio Nacional', esLocal:false },
  { n:38, local:'CD Eldense',    visitante:'UD Las Palmas',         fecha:'2027-05-09', estadio:'Nuevo Pepico Amat', esLocal:false },
  { n:39, local:'UD Las Palmas', visitante:'UD Almería',            fecha:'2027-05-16', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:40, local:'Burgos CF',     visitante:'UD Las Palmas',         fecha:'2027-05-23', estadio:'El Plantío', esLocal:false },
  { n:41, local:'UD Las Palmas', visitante:'Córdoba CF',            fecha:'2027-05-30', estadio:'Estadio de Gran Canaria', esLocal:true },
  { n:42, local:'AD Ceuta FC',   visitante:'UD Las Palmas',         fecha:'2027-06-06', estadio:'Estadio Alfonso Murube', esLocal:false },
];

async function cargarJornadas() {
  console.log('Iniciando carga de las 42 jornadas...');
  
  // Firestore batch máximo es 500 ops, lo hacemos en lotes de 20
  let count = 0;
  for (const j of JORNADAS) {
    const equipoLocal    = j.esLocal ? 'UD Las Palmas' : j.local;
    const equipoVisitante = j.esLocal ? j.visitante : 'UD Las Palmas';
    
    // Fecha de cierre: día del partido a las 11:00 (1h antes del mediodía)
    const fechaPartido = new Date(j.fecha + 'T12:00:00');
    const fechaCierre  = new Date(fechaPartido.getTime() - 60 * 60 * 1000);

    const docId = 'jornada_' + String(j.n).padStart(2, '0');
    
    await db.collection('jornadas').doc(docId).set({
      numeroJornada:    j.n,
      equipoLocal:      equipoLocal,
      equipoVisitante:  equipoVisitante,
      udlpEsLocal:      j.esLocal,
      fecha:            j.fecha,
      estadio:          j.estadio,
      fechaCierre:      admin.firestore.Timestamp.fromDate(fechaCierre),
      estado:           j.n === 1 ? 'Abierta' : 'Pendiente',
      resultadoLocal:   null,
      resultadoVisitante: null,
      ganadores:        [],
      esVIP:            false,
      derbi:            j.derbi || false,
      notificacionCierreEnviada: false,
      temporada:        '2026-27',
    }, { merge: true });
    
    count++;
    console.log(`  J${j.n}: ${equipoLocal} vs ${equipoVisitante} (${j.fecha}) ✓`);
  }

  console.log('');
  console.log('✅ ' + count + ' jornadas cargadas correctamente.');
  console.log('   → J1 UDLP vs Albacete está en estado "Abierta"');
  console.log('   → El resto en estado "Pendiente"');
  process.exit(0);
}

cargarJornadas().catch(function(err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
