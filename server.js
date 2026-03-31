// server.js - Football Dice Online Multiplayer Server
// Requires: npm install express socket.io
// Run with: node server.js
// Then open http://localhost:3000 in two browser tabs/windows

// Base para crear una aplicación web en tiempo real (como un chat o un juego) usando Node.js.

// 1. Importación de módulos:
// Carga el framework Express, que facilita el manejo de rutas (URLs) y peticiones HTTP.
const express = require('express');
// Importa el módulo nativo de Node para crear servidores web. 
// Es necesario para "unir" Express con Socket.io.
const http = require('http');
// Extrae la clase Server de la librería Socket.io, que permite la comunicación bidireccional 
// (tiempo real) entre el servidor y el cliente.
const { Server } = require('socket.io');
// Una herramienta nativa para manejar rutas de archivos y carpetas de forma segura, 
// sin importar si usas Windows, Mac o Linux.
const path = require('path');

// 2. Configuración del servidor:
// Inicializa una instancia de Express.
const app = express();
// Crea el servidor físico usando el módulo http, pero le pasa la configuración 
// de app (Express) para que gestione las peticiones.
const server = http.createServer(app);
// Monta el motor de Socket.io sobre el servidor HTTP. Ahora tu servidor puede 
// hablar HTTP normal y también WebSockets.
//const io = new Server(server);
const io = new Server(server, { cors: { origin: "*" }}); // Evita problemas cuando se conecten desde internet

// 3. Entorno y archivos
// : Define en qué puerto escuchará el servidor. Intenta usar uno definido por el servicio de 
// hosting (como Heroku o Railway) y, si no existe, usa el 3000 por defecto.
const PORT = process.env.PORT || 3000;
// Servir archivos estáticos (index.html, styles60.css, Ball.png, etc.)
// Le dice a Express que todos los archivos que estén en la carpeta llamada public 
// (como el HTML, CSS e imágenes) sean accesibles directamente desde el navegador.
app.use(express.static(path.join(__dirname, 'public')));










// ──────────────────────────────────────────────
// Estado de las salas de juego
// ──────────────────────────────────────────────

// Estructura de una sala:
// rooms[roomId] = {
//   players: { socketId: playerNumber (1 o 2) },
//   count: número de jugadores conectados,
//   gameState: objeto con el estado completo del juego,
//   started: boolean
// }
const rooms = {};

// Sala por defecto (para demo de 2 jugadores simples)
const DEFAULT_ROOM = 'room1';

// ──────────────────────────────────────────────
// Estado inicial del juego (servidor lo gestiona para re-sincronizar)
// ──────────────────────────────────────────────
function createInitialGameState(maxPossessions) {
    return {
        currentPlayer: 1,
        opponent: 2,
        maxPossessions: maxPossessions || 10,
        isGameOver: false,
        isPunt: false,
        lastPossession: { 1: false, 2: false },
        scores: { 1: 0, 2: 0 },
        // Estado de celdas de info para re-sincronizar si alguien se reconecta
        cells: {
            1: { score: '00', possN: '1', downN: '1st', to_go: '10', ydLine: '30', ydLineSide: 1, timeouts: 3, defPlays: 3 },
            2: { score: '00', possN: '-',  downN: '-',  to_go: '-',  ydLine: '-',  ydLineSide: null, timeouts: 3, defPlays: 3 }
        },
        playByPlay: [],
        dice: { d1: null, d2: null, d3: null },
        stats: {
            1: { td: 0, fg: { made: 0, att: 0 }, xp: { made: 0, att: 0 }, pt2: { made: 0, att: 0 }, punts: 0, turnovers: 0, safety: 0 },
            2: { td: 0, fg: { made: 0, att: 0 }, xp: { made: 0, att: 0 }, pt2: { made: 0, att: 0 }, punts: 0, turnovers: 0, safety: 0 }
        }
    };
}

// ──────────────────────────────────────────────
// Gestión de conexiones Socket.io
// ──────────────────────────────────────────────

// Eventos (emit y on): Es el lenguaje que servidor y cliente. 
// El servidor puede "emitir" un evento llamado 'nuevo_mensaje' 
// y el cliente tiene un "oído" puesto con on para reaccionar cuando ese evento ocurra.

io.on('connection', (socket) => {
    console.log(`[+] Socket connected: ${socket.id}`);

    // ── UNIRSE A UNA SALA ──────────────────────
    socket.on('joinRoom', ({ roomId }) => {
        const room = roomId || DEFAULT_ROOM;

        if (!rooms[room]) {
            rooms[room] = {
                players: {},
                count: 0,
                gameState: null,
                started: false
            };
        }

        const roomData = rooms[room];

        // Máximo 2 jugadores por sala
        if (roomData.count >= 2) {
            socket.emit('roomFull');
            return;
        }

        // Asignar número de jugador
        const existingNumbers = Object.values(roomData.players);
        const playerNumber = existingNumbers.includes(1) ? 2 : 1;

        roomData.players[socket.id] = playerNumber;
        roomData.count++;
        socket.join(room);
        socket.roomId = room;
        socket.playerNumber = playerNumber;

        console.log(`  Player ${playerNumber} joined room "${room}" (${roomData.count}/2)`);

        // Confirmación al jugador que se une
        socket.emit('assignedPlayer', {
            playerNumber,
            roomId: room,
            waitingForOpponent: roomData.count < 2
        });

        // Si ya hay 2 jugadores, notificar a ambos para mostrar menú de inicio
        if (roomData.count === 2) {
            io.to(room).emit('opponentJoined');
        }
    });





    // ── INICIO DE PARTIDA ──────────────────────
    socket.on('startGame', ({ maxPossessions }) => {
        const room = socket.roomId;
        if (!room || !rooms[room]) return;

        // Solo el jugador 1 puede iniciar
        if (socket.playerNumber !== 1) return;

        const gs = createInitialGameState(maxPossessions);
        rooms[room].gameState = gs;
        rooms[room].started = true;

        console.log(`  Game started in room "${room}" (${maxPossessions} possessions)`);
        io.to(room).emit('gameStarted', { maxPossessions, gameState: gs });
    });

    // ── TIRADA DE DADOS ──────────────────────────
    // El cliente del jugador activo envía la tirada; el servidor la retransmite
    // junto con la acción de juego completa para que ambas pantallas se sincronicen.
    socket.on('diceRoll', (data) => {
        const room = socket.roomId;
        if (!room || !rooms[room]) return;
        if (!rooms[room].started) return;

        const gs = rooms[room].gameState;

        // Verificar que es el turno correcto
        if (socket.playerNumber !== gs.currentPlayer) {
            socket.emit('notYourTurn');
            return;
        }

        // Guardar dados en estado global
        gs.dice = { d1: data.d1, d2: data.d2, d3: data.d3, colValue: data.colValue, numDice: data.numDice };
        // Retransmitir la tirada a AMBOS jugadores (incluido el que tiró)
        io.to(room).emit('diceResult', data);
    });

    // ── ACTUALIZACIÓN DE ESTADO ───────────────────
    // Después de procesar la lógica de juego en el cliente activo,
    // éste envía el nuevo estado completo para sincronizar al rival.
    socket.on('syncState', (stateUpdate) => {
        const room = socket.roomId;
        if (!room || !rooms[room]) return;

        // Actualizar estado en servidor
        if (rooms[room].gameState) {
            Object.assign(rooms[room].gameState, stateUpdate);
        }

        // Enviar al OTRO jugador (el que no acaba de jugar)
        socket.to(room).emit('stateSync', stateUpdate);
    });

    // ── EVENTO DE DECISIÓN TO/TURNOVER ────────────
    // Cuando el jugador 1 decide en el modal de TO, se sincroniza con el jugador 2
    socket.on('toDecision', (data) => {
        const room = socket.roomId;
        if (!room) return;
        socket.to(room).emit('toDecisionSync', data);
    });

    // ── PLAY BY PLAY ──────────────────────────────
    socket.on('playByPlay', (data) => {
        const room = socket.roomId;
        if (!room || !rooms[room]) return;
        if (rooms[room].gameState) {
            rooms[room].gameState.playByPlay.push(data.html);
        }
        // Enviar al otro jugador
        socket.to(room).emit('playByPlaySync', data);
    });

    // ── GAME OVER ─────────────────────────────────
    socket.on('gameOver', (data) => {
        const room = socket.roomId;
        if (!room) return;
        if (rooms[room]) rooms[room].started = false;
        socket.to(room).emit('gameOverSync', data);
    });

    // ── DESCONEXIÓN ───────────────────────────────
    socket.on('disconnect', () => {
        const room = socket.roomId;
        console.log(`[-] Socket desconectado: ${socket.id}`);

        if (room && rooms[room]) {
            delete rooms[room].players[socket.id];
            rooms[room].count--;

            if (rooms[room].count <= 0) {
                delete rooms[room];
                console.log(`  Room "${room}" eliminada.`);
            } else {
                // Notificar al otro jugador que el rival se desconectó
                io.to(room).emit('opponentDisconnected');
                rooms[room].started = false;
            }
        }
    });
});

// ──────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n🏈 Football Dice Server running in http://localhost:${PORT}`);
    console.log(`   Place index.html, styles60.css y Ball.png in folder /public\n`);
});