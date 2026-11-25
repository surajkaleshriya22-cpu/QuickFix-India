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

/** One app-wide language state shared by Customer, Partner and Admin destinations. */
val LocalQuickFixLanguage = compositionLocalOf<MutableState<String>> {
    mutableStateOf("hi")
}

@Composable
fun QuickFixLanguageSelector() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(LANGUAGE_PREFS, Context.MODE_PRIVATE) }
    val languageState = LocalQuickFixLanguage.current
    val language = languageState.value
    var expanded by remember { mutableStateOf(false) }

    Box {
        TextButton(onClick = { expanded = true }) {
            Text(if (language == "en") "EN" else "हिंदी")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text("हिंदी") }, onClick = {
                languageState.value = "hi"
                prefs.edit().putString(LANGUAGE_KEY, "hi").apply()
                expanded = false
            })
            DropdownMenuItem(text = { Text("English") }, onClick = {
                languageState.value = "en"
                prefs.edit().putString(LANGUAGE_KEY, "en").apply()
                expanded = false
            })
        }
    }
}
