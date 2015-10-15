package org.opennms.cordova.storage;

import java.io.BufferedReader;
import java.io.Closeable;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
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

public class LocalStoragePlugin extends CordovaPlugin {
    private static final String TAG = "LocalStoragePlugin";

    @Override
    public boolean execute(final String action, final CordovaArgs args, final CallbackContext callbackContext) throws JSONException {
        JSONStorageResult result = null;
        if ("onmsGetJsonFileContents".equals(action)) {
            final String filename = args.getString(0);
            result = readJson(filename);
        } else if ("onmsSetJsonFileContents".equals(action)) {
            final String filename = args.getString(0);
            final JSONObject contents = args.getJSONObject(1);
            result = writeJson(filename, contents);
        } else if ("onmsRemoveJsonFile".equals(action)) {
            final String filename = args.getString(0);
            result = removeJsonFile(filename);
        } else if ("onmsListJsonFiles".equals(action)) {
            final String path = args.getString(0);
            result = listFiles(path);
        } else if ("onmsWipe".equals(action)) {
            result = wipeData();
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

    private JSONStorageResult readJson(final String filePath) {
        final File inputFile = getStorageLocation(filePath);
        Log.d(TAG, "Reading: " + inputFile);
        if (!inputFile.exists() || !inputFile.canRead()) {
            return new JSONStorageResult(false, "Unable to read file.", filePath + " does not exist or is not readable.");
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
            return new JSONStorageResult(true, obj);
        } catch (final Exception e) {
            return new JSONStorageResult(false, "Unable to read file.", "Failed to read " + filePath + ": " + e.getLocalizedMessage());
        } finally {
            closeQuietly(br);
            closeQuietly(isr);
            closeQuietly(fis);
        }
    }

    private JSONStorageResult writeJson(final String filePath, final JSONObject contents) {
        final File outputFile = getStorageLocation(filePath);
        Log.d(TAG, "Writing: " + outputFile);
        makeParent(outputFile);

        String jsonString;
        try {
            jsonString = contents.toString(4);
        } catch (final JSONException e) {
            return new JSONStorageResult(false, "Failed to serialize JSON.", e.getLocalizedMessage());
        }

        FileWriter fw = null;
        try {
            fw = new FileWriter(outputFile);
            fw.write(jsonString);
            return new JSONStorageResult(true);
        } catch (final Exception e) {
            return new JSONStorageResult(false, "Failed to write JSON.", "Failed to write " + filePath + ": " + e.getLocalizedMessage());
        } finally {
            closeQuietly(fw);
        }
    }

    private JSONStorageResult removeJsonFile(final String filePath) {
        final File removedFile = getStorageLocation(filePath);
        Log.d(TAG,  "Removing: " + removedFile);
        if (!removedFile.exists()) {
            return new JSONStorageResult(true);
        }
        return new JSONStorageResult(removedFile.delete());
    }

    private JSONStorageResult listFiles(final String path) {
        final File directory = getStorageLocation(path);
        final String root = getStorageLocation("").getAbsolutePath();
        Log.d(TAG, "root directory = " + root);

        if (!directory.exists()) {
            return new JSONStorageResult(false, "Directory missing.", "Directory '" + path + "' does not exist.");
        }
        final File[] entries = directory.listFiles();
        Arrays.sort(entries);
        final JSONArray ret = new JSONArray();
        for (final File entry : entries) {
            if (!entry.isDirectory()) {
                ret.put(entry.getName());
            }
        }
        return new JSONStorageResult(true, ret);
    }

    private JSONStorageResult wipeData() {
        final File directory = getStorageRoot();
        try {
            final boolean success = deleteRecursive(directory);
            return new JSONStorageResult(success);
        } catch (final Exception e) {
            return new JSONStorageResult(false, "Failed to wipe data.", "Unable to wipe data: " + e.getLocalizedMessage());
        }
    }

    private static boolean deleteRecursive(final File path) throws FileNotFoundException {
        if (!path.exists()) throw new FileNotFoundException(path.getAbsolutePath());
        boolean ret = true;
        if (path.isDirectory()) {
            for (final File f : path.listFiles()) {
                ret = ret && LocalStoragePlugin.deleteRecursive(f);
            }
        }
        return ret && path.delete();
    }

    private File getStorageRoot() {
        final File rootDirectory = cordova.getActivity().getFilesDir();
        return new File(rootDirectory.getAbsolutePath() + File.separator + "cordova-plugin-json-storage");
    }

    private File getStorageLocation(final String relativePath) {
        return new File(getStorageRoot() + File.separator + relativePath);
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
