package org.opennms.cordova.storage;

import java.io.BufferedReader;
import java.io.Closeable;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.InputStreamReader;
import java.util.Arrays;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.util.Log;

public class CloudStoragePlugin extends CordovaPlugin {
    public static enum StorageType {
        PUBLIC,
        PRIVATE
    }

    private static final String TAG = "CloudStoragePlugin";

    @Override
    public boolean execute(final String action, final CordovaArgs args, final CallbackContext callbackContext) throws JSONException {
        CloudStorageResult result = null;
        if ("onmsGetJsonFileContents".equals(action)) {
            final String filename = args.getString(0);
            result = readJson(filename, StorageType.PUBLIC);
        } else if ("onmsSetJsonFileContents".equals(action)) {
            final String filename = args.getString(0);
            final JSONObject contents = args.getJSONObject(1);
            result = writeJson(filename, contents, StorageType.PUBLIC);
        } else if ("onmsRemoveJsonFile".equals(action)) {
            final String filename = args.getString(0);
            result = removeJsonFile(filename, StorageType.PUBLIC);
        } else if ("onmsListJsonFiles".equals(action)) {
            final String path = args.getString(0);
            result = listFiles(path, StorageType.PUBLIC);
        } else if ("onmsGetPrivateJsonFileContents".equals(action)) {
            final String filename = args.getString(0);
            result = readJson(filename, StorageType.PRIVATE);
        } else if ("onmsSetPrivateJsonFileContents".equals(action)) {
            final String filename = args.getString(0);
            final JSONObject contents = args.getJSONObject(1);
            result = writeJson(filename, contents, StorageType.PRIVATE);
        } else if ("onmsRemovePrivateJsonFile".equals(action)) {
            final String filename = args.getString(0);
            result = removeJsonFile(filename, StorageType.PRIVATE);
        } else if ("onmsListPrivateJsonFiles".equals(action)) {
            final String path = args.getString(0);
            result = listFiles(path, StorageType.PRIVATE);
        }

        if (result != null) {
            if (result.isSuccess()) {
                callbackContext.success(result.toCallbackContextResponse());
                return true;
            } else {
                callbackContext.error(result.toCallbackContextResponse());
                return false;
            }
        } else {
            callbackContext.error("An unknown error occurred.");
            return false;
        }
    }

    private File getStorageLocation(final String relativePath, final StorageType type) {
        final File rootDirectory = cordova.getActivity().getFilesDir();
        final File storageDirectory;
        switch (type) {
        case PRIVATE:
            storageDirectory = new File(rootDirectory, "NoCloud");
            break;
        case PUBLIC:
        default:
            storageDirectory = new File(rootDirectory, "Cloud");
            break;
        }
        return new File(storageDirectory.getAbsolutePath() + File.separator + relativePath);
    }

    private CloudStorageResult readJson(final String filePath, final StorageType type) {
        final File inputFile = getStorageLocation(filePath, type);
        Log.d(TAG, "Reading: " + inputFile);
        if (!inputFile.exists() || !inputFile.canRead()) {
            return new CloudStorageResult(false, "Unable to read file.", filePath + " does not exist or is not readable.");
        }

        FileInputStream fis = null;
        InputStreamReader isr = null;
        BufferedReader br = null;
        final StringBuilder sb = new StringBuilder();
        try {
            fis = new FileInputStream(inputFile);
            isr = new InputStreamReader(fis);
            br = new BufferedReader(isr);
            String line = null;
            while ((line = br.readLine()) != null) {
                sb.append(line).append("\n");
            }
            final JSONObject obj = new JSONObject(sb.toString());
            return new CloudStorageResult(true, obj);
        } catch (final Exception e) {
            return new CloudStorageResult(false, "Unable to read file.", "Failed to read " + filePath + ": " + e.getLocalizedMessage());
        } finally {
            closeQuietly(br);
            closeQuietly(isr);
            closeQuietly(fis);
        }
    }

    private CloudStorageResult writeJson(final String filePath, final JSONObject contents, final StorageType type) {
        final File outputFile = getStorageLocation(filePath, type);
        Log.d(TAG, "Writing: " + outputFile);
        makeParent(outputFile);

        String jsonString;
        try {
            jsonString = contents.toString(4);
        } catch (final JSONException e) {
            return new CloudStorageResult(false, "Failed to serialize JSON.", e.getLocalizedMessage());
        }

        FileWriter fw = null;
        try {
            fw = new FileWriter(outputFile);
            fw.write(jsonString);
            return new CloudStorageResult(true);
        } catch (final Exception e) {
            return new CloudStorageResult(false, "Failed to write JSON.", "Failed to write " + filePath + ": " + e.getLocalizedMessage());
        } finally {
            closeQuietly(fw);
        }
    }

    private CloudStorageResult removeJsonFile(final String filePath, final StorageType type) {
        final File removedFile = getStorageLocation(filePath, type);
        Log.d(TAG,  "Removing: " + removedFile);
        if (!removedFile.exists()) {
            return new CloudStorageResult(true);
        }
        return new CloudStorageResult(removedFile.delete());
    }

    private CloudStorageResult listFiles(final String path, final StorageType type) {
        final File directory = getStorageLocation(path, type);
        final String root = getStorageLocation("", type).getAbsolutePath();
        Log.d(TAG, "root directory = " + root);

        if (!directory.exists()) {
            return new CloudStorageResult(false, "Directory missing.", "Directory '" + path + "' does not exist.");
        }
        final File[] entries = directory.listFiles();
        Arrays.sort(entries);
        final JSONArray ret = new JSONArray();
        for (final File entry : entries) {
            final String relativeEntry = entry.getAbsolutePath().replace((root.endsWith("/")? root:root+"/"), "");
            if (relativeEntry.startsWith("/")) {
                Log.d(TAG, "Er?  Relative entry is " + relativeEntry);
            } else {
                ret.put(relativeEntry);
            }
        }
        return new CloudStorageResult(true, ret);
    }

    private static void makeParent(final File file) {
        final File parent = file.getParentFile();
        if (!parent.exists()) {
            makeParent(parent);
            Log.d(TAG, "Creating directory: " + parent);
            parent.mkdir();
        }
    }

    private static void closeQuietly(final Closeable c) {
        if (c != null) {
            try {
                c.close();
            } catch (final Exception e) {
            }
        }
    }
}
