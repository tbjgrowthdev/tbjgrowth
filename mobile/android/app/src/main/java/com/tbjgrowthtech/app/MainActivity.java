package com.tbjgrowthtech.app;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Only our own site's files are downloaded (reports, invoices and update
    // attachments behind /api/portal/files, the admin APK). Anything else is ignored.
    private static final String HOST = "tbjgrowthtech.com";
    private static final int STORAGE_REQUEST = 4711;

    // A download waiting for the storage permission (Android 9 and below).
    private DownloadManager.Request pendingDownload;
    private String pendingFileName;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android's WebView does nothing with a Content-Disposition: attachment
        // response unless a DownloadListener is set. Hand it to DownloadManager,
        // with the WebView's cookies: the files are behind the signed-in session.
        getBridge().getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                Uri uri = Uri.parse(url);
                if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost())) return;
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request request = new DownloadManager.Request(uri);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) request.addRequestHeader("Cookie", cookies);
                request.addRequestHeader("User-Agent", userAgent);
                request.setMimeType(mimeType);
                request.setTitle(fileName);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                // Android 9 and below: saving to Downloads needs the storage
                // permission (declared with maxSdkVersion 28). Ask once, then go on.
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                        && ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    pendingDownload = request;
                    pendingFileName = fileName;
                    ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE }, STORAGE_REQUEST);
                    return;
                }
                enqueue(request, fileName);
            } catch (Exception e) {
                Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != STORAGE_REQUEST) return;
        DownloadManager.Request request = pendingDownload;
        String fileName = pendingFileName;
        pendingDownload = null;
        pendingFileName = null;
        if (request == null) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            enqueue(request, fileName);
        } else {
            Toast.makeText(this, "Allow storage access to download files", Toast.LENGTH_LONG).show();
        }
    }

    private void enqueue(DownloadManager.Request request, String fileName) {
        try {
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) return;
            manager.enqueue(request);
            Toast.makeText(this, fileName, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show();
        }
    }
}
