package de.steppicrew.quotebingo;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Edge-to-edge on every version, not just the Android 15+ where the
        // system forces it: one layout everywhere, and no deprecated bar-colour
        // calls. The page pads itself by the insets (see SystemBarsPlugin).
        EdgeToEdge.enable(this);
        // Registered before super.onCreate so the bridge picks it up.
        registerPlugin(SystemBarsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
