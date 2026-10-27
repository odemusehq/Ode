import json
import os

from _Framework.ControlSurface import ControlSurface

from .browser import BrowserCommands
from .server import BridgeServer


class OdeBridge(ControlSurface):
    """Ode's Python bridge: loads plug-ins, presets and samples from Live's browser for Ode's server.

    Live only offers browser loading to control-surface scripts, so this bridge does that and nothing else.
    Requests arrive on a socket thread and run here, on Live's main thread, in update_display.
    """

    def __init__(self, c_instance):
        ControlSurface.__init__(self, c_instance)
        settings = self._read_settings()
        self._commands = BrowserCommands(self.application(), self.song())
        self._server = BridgeServer(settings["host"], int(settings["port"]))
        self._server.start()
        self.log_message("Ode bridge listening on %s:%s" % (settings["host"], settings["port"]))

    def update_display(self):
        ControlSurface.update_display(self)
        for request, reply in self._server.take_requests():
            reply(self._run(request))

    def disconnect(self):
        self._server.stop()
        ControlSurface.disconnect(self)

    def _run(self, request):
        try:
            result = self._commands.run(request["op"], request.get("args") or {})
            return {"id": request["id"], "ok": True, "result": result}
        except Exception as error:
            return {"id": request.get("id"), "ok": False, "error": str(error)}

    def _read_settings(self):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
        with open(path, "r") as settings_file:
            return json.load(settings_file)
