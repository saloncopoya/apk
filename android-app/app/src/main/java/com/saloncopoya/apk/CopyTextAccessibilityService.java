package com.saloncopoya.apk;

import android.accessibilityservice.AccessibilityService;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import java.util.List;

public class CopyTextAccessibilityService extends AccessibilityService {

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // No hacemos nada aquí. El servicio solo se usa cuando la ventana flotante lo invoca.
    }

    @Override
    public void onInterrupt() {}

    /**
     * Este método es llamado desde FloatingWindowService.
     * Recorre el árbol de accesibilidad de la ventana activa y extrae todo el texto.
     */
    public String copyAllTextFromScreen() {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) {
            return null;
        }

        StringBuilder allText = new StringBuilder();
        extractText(rootNode, allText);
        
        if (allText.length() > 0) {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newPlainText("Texto copiado", allText.toString());
            clipboard.setPrimaryClip(clip);
            return allText.toString();
        }
        return null;
    }

    private void extractText(AccessibilityNodeInfo node, StringBuilder builder) {
        if (node == null) return;

        // Extraer texto del nodo
        if (node.getText() != null) {
            builder.append(node.getText().toString()).append("\n");
        }
        // Si tiene contenido de descripción (a veces el texto está aquí)
        if (node.getContentDescription() != null) {
            builder.append(node.getContentDescription().toString()).append("\n");
        }

        // Recorrer hijos
        for (int i = 0; i < node.getChildCount(); i++) {
            extractText(node.getChild(i), builder);
        }
    }
}
