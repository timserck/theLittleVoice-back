var http = require('http');
var io = require('socket.io');

// --- HTTP Server ---
var httpServer = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end("Server running...");
    console.log("HTTP request received");
});

httpServer.listen(1337, () => {
    console.log("Server listening on port 1337");
});

// --- Socket.IO ---
io = io(httpServer);
io.set('heartbeat interval', 10000);
io.set('heartbeat timeout', 60000);

// --- Global State ---
var users = {};
var nbr_room = -1;
var room_name = 'room';

// --- Heartbeat (single loop, not per-client) ---
function sendHeartbeat() {
    io.sockets.emit('ping', { beat: 1 });
    setTimeout(sendHeartbeat, 8000);
}
sendHeartbeat();

// --- Socket Connections ---
io.sockets.on('connection', function (socket) {
    var me = false;
    console.log('New user connected');

    // Notify about existing users
    for (var k in users) {
        socket.emit('newuser', users[k]);
    }

    socket.on('pong', function () {
        console.log("Pong received from client");
    });

    // --- Login ---
    socket.on('login', function (user) {
        if (!user || !user.username) return;

        me = user;

        if (!users[me.username]) {
            socket.emit('logged');
            me.socket_id = socket.id;
            users[me.username] = me;

            io.sockets.emit('newuser', me);
            socket.emit('current_user', me);

            console.log(`${me.username} logged in`);
        } else {
            me = false;
            socket.emit('change_pseudo', false);
            console.log("Username already taken");
        }
    });

    // --- Invite ---
    socket.on('invite', function (id, username, current_user_id) {
        socket.broadcast.to(id).emit('invite_send', {
            username: username,
            id: current_user_id
        });
    });

    // --- Launch game ---
    socket.on('launch', function (data) {
        console.log(users, 'users list');
        console.log(data, 'launch request');

        for (var k in users) {
            if (data.id_coop === users[k].socket_id) {
                socket.emit('launch_send');
                socket.broadcast.to(data.id_coop).emit('launch_send');
            } else {
                socket.emit('invite_an_other');
            }
        }
    });

    // --- Create room ---
    socket.on('create', function () {
        nbr_room++;

        if (nbr_room === 2) {
            nbr_room = 0;
            room_name = 'room_' + me.socket_id;
        }

        if (nbr_room === 1) {
            socket.emit('aveugle');
        }

        me.room = room_name;
        io.emit('disuseur', me);

        // no delete from users here — keep user until disconnect
        socket.join(room_name);

        io.in(room_name).emit('start', room_name);
        console.log(`${me.username} joined ${room_name}`);
    });

    // --- Share map ---
    socket.on('share_map', function (map_and_current_room) {
        socket.broadcast.to(map_and_current_room.current_room)
            .emit('send_map', map_and_current_room.map);
    });

    // --- Movements ---
    socket.on('mouvement', function (mouvement) {
        console.log(mouvement, 'movement');
        var direction = mouvement.direction;
        io.in(mouvement.current_room).emit('recive', direction);
    });

    socket.on('sound', function (mouvement) {
        var direction = mouvement.direction;
        io.in(mouvement.current_room).emit('sound_send', direction);
    });

    // --- Game state events ---
    socket.on('game_over', function (current_room) {
        io.in(current_room).emit('game_over_send');
    });

    socket.on('success', function (current_room) {
        io.in(current_room).emit('success_send');
    });

    socket.on('reset', function (current_room) {
        io.in(current_room).emit('reset_send');
    });

    socket.on('repeat', function (current_room) {
        socket.broadcast.to(current_room).emit('repeat_send');
    });

    // --- Disconnect ---
    socket.on('disconnect', function () {
        console.log('User disconnected');

        if (!me) return;

        if (me.room) {
            socket.broadcast.to(me.room).emit('disconenct_room');
        }

        io.emit('disuseur', me);

        if (users[me.username]) {
            delete users[me.username];
            console.log(`User ${me.username} removed from users`);
        }
    });
});