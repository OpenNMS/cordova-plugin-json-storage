package org.opennms.cordova.storage;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class CloudStorageResult {
    private final boolean m_success;
    private final String m_message;
    private final String m_reason;
    private final Object m_contents;

    public CloudStorageResult(final boolean success) {
        m_success = success;
        m_message = null;
        m_reason = null;
        m_contents = null;
    }

    public CloudStorageResult(final boolean success, final JSONArray contents) {
        m_success = success;
        m_message = null;
        m_reason = null;
        m_contents = contents;
    }

    public CloudStorageResult(final boolean success, final JSONObject contents) {
        m_success = success;
        m_message = null;
        m_reason = null;
        m_contents = contents;
    }

    public CloudStorageResult(final boolean success, final String message, final String reason) {
        m_success = success;
        m_message = message;
        m_reason = reason;
        m_contents = null;
    }

    public boolean isSuccess() {
        return m_success;
    }
    public JSONObject toCallbackContextResponse() throws JSONException {
        final JSONObject obj = new JSONObject();
        obj.put("success", m_success);
        if (m_message != null) {
            obj.put("error", m_message);
        }
        if (m_reason != null) {
            obj.put("reason", m_reason);
        }
        if (m_contents != null) {
            obj.put("contents", m_contents);
        }
        return obj;
    }

    @Override
    public String toString() {
        return "CloudStorageResult [success=" + m_success + ", message=" + m_message + ", reason=" + m_reason + ", contents=" + m_contents + "]";
    }
}
