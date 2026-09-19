package de.steppicrew.quotebingo;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Registered before super.onCreate so the bridge picks it up.
        registerPlugin(SystemBarsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
