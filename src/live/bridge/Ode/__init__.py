from .bridge import OdeBridge


def create_instance(c_instance):
    return OdeBridge(c_instance)
