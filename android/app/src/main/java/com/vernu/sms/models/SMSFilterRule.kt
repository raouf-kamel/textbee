package com.vernu.sms.models

class SMSFilterRule @JvmOverloads constructor(
    var pattern: String? = null,
    var matchType: MatchType? = null,
    filterTarget: FilterTarget? = FilterTarget.SENDER,
    var caseSensitive: Boolean = false,
) {
    enum class MatchType {
        EXACT,
        STARTS_WITH,
        ENDS_WITH,
        CONTAINS,
    }

    enum class FilterTarget {
        SENDER,
        MESSAGE,
        BOTH,
    }

    var filterTarget: FilterTarget = filterTarget ?: FilterTarget.SENDER
        set(value) {
            field = value
        }

    fun isCaseSensitive(): Boolean = caseSensitive

    private fun matchesString(text: String?): Boolean {
        val currentPattern = pattern ?: return false
        val currentMatchType = matchType ?: return false
        val candidate = text ?: return false

        val patternToMatch = if (caseSensitive) currentPattern else currentPattern.lowercase()
        val textToMatch = if (caseSensitive) candidate else candidate.lowercase()

        return when (currentMatchType) {
            MatchType.EXACT -> textToMatch == patternToMatch
            MatchType.STARTS_WITH -> textToMatch.startsWith(patternToMatch)
            MatchType.ENDS_WITH -> textToMatch.endsWith(patternToMatch)
            MatchType.CONTAINS -> textToMatch.contains(patternToMatch)
        }
    }

    fun matches(sender: String?, message: String?): Boolean {
        if (pattern == null) {
            return false
        }

        return when (filterTarget) {
            FilterTarget.SENDER -> matchesString(sender)
            FilterTarget.MESSAGE -> matchesString(message)
            FilterTarget.BOTH -> matchesString(sender) || matchesString(message)
        }
    }

    fun matches(sender: String?): Boolean = matches(sender, null)
}
