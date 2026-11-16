package com.saloncopoya.apk;

import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import androidx.annotation.RequiresApi;

@RequiresApi(api = Build.VERSION_CODES.N)
public class MyQSTileService extends TileService {
    private boolean isActive = false;

    @Override
    public void onStartListening() {
        super.onStartListening();
        updateTile();
    }

    @Override
    public void onClick() {
        super.onClick();
        isActive = !isActive;
        updateTile();

        if (isActive) {
            // Encender ventana
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(new Intent(this, FloatingWindowService.class));
            } else {
                startService(new Intent(this, FloatingWindowService.class));
            }
        } else {
            // Apagar ventana
            stopService(new Intent(this, FloatingWindowService.class));
        }
    }

    private void updateTile() {
        Tile tile = getQsTile();
        if (tile != null) {
            tile.setState(isActive ? Tile.STATE_ACTIVE : Tile.STATE_INACTIVE);
            tile.setLabel(isActive ? "Ventana Flotante ON" : "Ventana Flotante OFF");
            tile.updateTile();
        }
    }
}
