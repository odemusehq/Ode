import json
import queue
import socket
import threading


class ClientConnection(object):
    """One connection from Ode's server: reads JSON lines, writes JSON-line replies."""

    def __init__(self, sock, requests):
        self._sock = sock
        self._requests = requests
        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._read_loop)
        self._thread.daemon = True

    def start(self):
        self._thread.start()

    def reply(self, response):
        data = (json.dumps(response) + "\n").encode("utf-8")
        with self._lock:
            try:
                self._sock.sendall(data)
            except OSError:
                pass

    def _read_loop(self):
        buffer = b""
        while True:
            try:
                chunk = self._sock.recv(65536)
            except OSError:
                break
            if not chunk:
                break
            buffer += chunk
            while b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                if line.strip():
                    self._requests.put((json.loads(line.decode("utf-8")), self.reply))
        self._sock.close()


class BridgeServer(object):
    """Listens on a local TCP port; requests are queued for Live's main thread."""

    def __init__(self, host, port):
        self._host = host
        self._port = port
        self._requests = queue.Queue()
        self._listener = None
        self._running = False
        self._thread = threading.Thread(target=self._accept_loop)
        self._thread.daemon = True

    def start(self):
        self._listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._listener.bind((self._host, self._port))
        self._listener.listen(4)
        self._running = True
        self._thread.start()

    def stop(self):
        self._running = False
        if self._listener is not None:
            self._listener.close()

    def take_requests(self):
        taken = []
        while True:
            try:
                taken.append(self._requests.get_nowait())
            except queue.Empty:
                return taken

    def _accept_loop(self):
        while self._running:
            try:
                sock, _address = self._listener.accept()
            except OSError:
                break
            ClientConnection(sock, self._requests).start()
