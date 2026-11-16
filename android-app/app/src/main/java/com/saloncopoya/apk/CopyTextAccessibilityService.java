package com.saloncopoya.apk;

import android.accessibilityservice.AccessibilityService;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class CopyTextAccessibilityService extends AccessibilityService {

    private static CopyTextAccessibilityService instance;

    public static CopyTextAccessibilityService getInstance() {
        return instance;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // No hacer nada. Solo se usa cuando la burbuja lo invoca.
    }

    @Override
    public void onInterrupt() {}

    /**
     * Recorre el árbol de accesibilidad de la app activa y copia todo el texto.
     * Devuelve el texto copiado o null si no encontró nada.
     */
    public String copyAllTextFromScreen() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return null;

        StringBuilder sb = new StringBuilder();
        extractText(root, sb);

        String text = sb.toString().trim();
        if (text.isEmpty()) return null;

        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("Texto copiado", text);
        cm.setPrimaryClip(clip);
        return text;
    }

    private void extractText(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null) return;

        if (node.getText() != null) {
            String t = node.getText().toString().trim();
            if (!t.isEmpty()) sb.append(t).append('\n');
        }
        if (node.getContentDescription() != null) {
            String d = node.getContentDescription().toString().trim();
            if (!d.isEmpty()) sb.append(d).append('\n');
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            extractText(node.getChild(i), sb);
        }
    }
}
