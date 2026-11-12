package nl.delaparraservices.apps.weather;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the widget snapshot from the web app (src/lib/widgets.ts) and redraws the widgets. */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Widgets.save(getContext(), call.getString("json", ""));
        Widgets.updateAll(getContext());
        call.resolve();
    }
}
