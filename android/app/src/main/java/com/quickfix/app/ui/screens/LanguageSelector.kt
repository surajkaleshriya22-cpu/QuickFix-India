package com.quickfix.app.ui.screens

import android.content.Context
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext

private const val LANGUAGE_PREFS = "quickfix_preferences"
private const val LANGUAGE_KEY = "app_language"

/** One observable language preference shared by every Compose screen. */
object QuickFixLanguage {
    var current by mutableStateOf("hi")
        private set

    fun load(context: Context) {
        current = context.getSharedPreferences(LANGUAGE_PREFS, Context.MODE_PRIVATE)
            .getString(LANGUAGE_KEY, "hi")?.takeIf { it == "en" || it == "hi" } ?: "hi"
    }

    fun set(context: Context, language: String) {
        val safeLanguage = if (language == "en") "en" else "hi"
        current = safeLanguage
        context.getSharedPreferences(LANGUAGE_PREFS, Context.MODE_PRIVATE)
            .edit().putString(LANGUAGE_KEY, safeLanguage).apply()
    }
}

@Composable
fun rememberQuickFixLanguage(): String {
    val context = LocalContext.current
    LaunchedEffect(context) { QuickFixLanguage.load(context) }
    return QuickFixLanguage.current
}

@Composable
fun QuickFixLanguageSelector() {
    val context = LocalContext.current
    val language = rememberQuickFixLanguage()
    var expanded by remember { mutableStateOf(false) }

    Box {
        TextButton(onClick = { expanded = true }) {
            Text(if (language == "en") "EN" else "हिं")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text("हिंदी") }, onClick = {
                QuickFixLanguage.set(context, "hi")
                expanded = false
            })
            DropdownMenuItem(text = { Text("English") }, onClick = {
                QuickFixLanguage.set(context, "en")
                expanded = false
            })
        }
    }
}
