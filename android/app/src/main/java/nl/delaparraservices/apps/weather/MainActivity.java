package nl.delaparraservices.apps.weather;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppIconPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStop() {
        super.onStop();
        // Switch the launcher icon to the current accent while the app is out of sight.
        AppIconPlugin.apply(this);
    }
}
