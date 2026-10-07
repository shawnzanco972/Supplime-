package com.shawnzanco.supplime;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Receives text shared to Supplime from other apps (for example a product from the
 * iHerb app) and hands it to the web layer, which opens the Add screen with it.
 */
@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {

    private static String pending;
    private static ShareInboxPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** Returns (and clears) text shared while the app was starting. */
    @PluginMethod
    public void take(PluginCall call) {
        JSObject result = new JSObject();
        result.put("text", pending);
        pending = null;
        call.resolve(result);
    }

    static void deliver(String text) {
        pending = text;
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("text", text);
            instance.notifyListeners("share", data, true);
        }
    }
}
