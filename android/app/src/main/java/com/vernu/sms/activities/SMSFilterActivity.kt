package com.vernu.sms.activities

import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ImageButton
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.android.material.textfield.TextInputEditText
import com.vernu.sms.R
import com.vernu.sms.helpers.SMSFilterHelper
import com.vernu.sms.models.SMSFilterRule

class SMSFilterActivity : AppCompatActivity() {
    private lateinit var context: Context
    private lateinit var filterEnabledSwitch: Switch
    private lateinit var filterModeRadioGroup: RadioGroup
    private lateinit var allowListRadio: RadioButton
    private lateinit var blockListRadio: RadioButton
    private lateinit var filterRulesRecyclerView: RecyclerView
    private lateinit var addRuleFab: FloatingActionButton
    private lateinit var adapter: FilterRulesAdapter
    private lateinit var filterConfig: SMSFilterHelper.FilterConfig

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_sms_filter)

        context = applicationContext

        val backButton = findViewById<ImageButton>(R.id.backButton)
        filterEnabledSwitch = findViewById(R.id.filterEnabledSwitch)
        filterModeRadioGroup = findViewById(R.id.filterModeRadioGroup)
        allowListRadio = findViewById(R.id.allowListRadio)
        blockListRadio = findViewById(R.id.blockListRadio)
        filterRulesRecyclerView = findViewById(R.id.filterRulesRecyclerView)
        addRuleFab = findViewById(R.id.addRuleFab)

        backButton.setOnClickListener { finish() }

        filterConfig = SMSFilterHelper.loadFilterConfig(context)

        adapter = FilterRulesAdapter(filterConfig.getRules())
        filterRulesRecyclerView.layoutManager = LinearLayoutManager(this)
        filterRulesRecyclerView.adapter = adapter

        filterEnabledSwitch.isChecked = filterConfig.isEnabled()
        if (filterConfig.getMode() == SMSFilterHelper.FilterMode.ALLOW_LIST) {
            allowListRadio.isChecked = true
        } else {
            blockListRadio.isChecked = true
        }

        filterEnabledSwitch.setOnCheckedChangeListener { _, isChecked ->
            filterConfig.setEnabled(isChecked)
            saveFilterConfig()
        }

        filterModeRadioGroup.setOnCheckedChangeListener { _, checkedId ->
            if (checkedId == R.id.allowListRadio) {
                filterConfig.setMode(SMSFilterHelper.FilterMode.ALLOW_LIST)
            } else {
                filterConfig.setMode(SMSFilterHelper.FilterMode.BLOCK_LIST)
            }
            saveFilterConfig()
        }

        addRuleFab.setOnClickListener { showAddEditRuleDialog(-1) }
    }

    private fun saveFilterConfig() {
        SMSFilterHelper.saveFilterConfig(context, filterConfig)
    }

    private fun showAddEditRuleDialog(position: Int) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_add_filter_rule, null)
        val builder = AlertDialog.Builder(this).setView(dialogView)

        val patternEditText = dialogView.findViewById<TextInputEditText>(R.id.patternEditText)
        val filterTargetSpinner = dialogView.findViewById<Spinner>(R.id.filterTargetSpinner)
        val matchTypeSpinner = dialogView.findViewById<Spinner>(R.id.matchTypeSpinner)
        val caseSensitiveSwitch = dialogView.findViewById<Switch>(R.id.caseSensitiveSwitch)
        val cancelButton = dialogView.findViewById<Button>(R.id.cancelButton)
        val saveButton = dialogView.findViewById<Button>(R.id.saveButton)

        val filterTargets = arrayOf("Sender", "Message", "Both")
        val targetAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, filterTargets)
        targetAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        filterTargetSpinner.adapter = targetAdapter

        val matchTypes = arrayOf("Exact Match", "Starts With", "Ends With", "Contains")
        val spinnerAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, matchTypes)
        spinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        matchTypeSpinner.adapter = spinnerAdapter

        val isEdit = position >= 0
        val dialogTitle = dialogView.findViewById<TextView>(R.id.dialogTitle)
        if (isEdit) {
            val rule = filterConfig.getRules()[position]
            patternEditText.setText(rule.pattern)
            filterTargetSpinner.setSelection(rule.filterTarget.ordinal)
            matchTypeSpinner.setSelection((rule.matchType ?: SMSFilterRule.MatchType.EXACT).ordinal)
            caseSensitiveSwitch.isChecked = rule.isCaseSensitive()
            dialogTitle?.text = "Edit Filter Rule"
        } else {
            caseSensitiveSwitch.isChecked = false
        }

        val dialog = builder.create()

        cancelButton.setOnClickListener { dialog.dismiss() }

        saveButton.setOnClickListener {
            val pattern = patternEditText.text?.toString()?.trim().orEmpty()
            if (pattern.isEmpty()) {
                Toast.makeText(this, "Please enter a pattern", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val filterTarget = SMSFilterRule.FilterTarget.values()[filterTargetSpinner.selectedItemPosition]
            val matchType = SMSFilterRule.MatchType.values()[matchTypeSpinner.selectedItemPosition]
            val caseSensitive = caseSensitiveSwitch.isChecked

            if (isEdit) {
                val rule = filterConfig.getRules()[position]
                rule.pattern = pattern
                rule.filterTarget = filterTarget
                rule.matchType = matchType
                rule.caseSensitive = caseSensitive
                adapter.notifyItemChanged(position)
            } else {
                val newRule = SMSFilterRule(pattern, matchType, filterTarget, caseSensitive)
                filterConfig.getRules().add(newRule)
                adapter.notifyItemInserted(filterConfig.getRules().size - 1)
            }

            saveFilterConfig()
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun deleteRule(position: Int) {
        AlertDialog.Builder(this)
            .setTitle("Delete Rule")
            .setMessage("Are you sure you want to delete this filter rule?")
            .setPositiveButton("Delete") { _, _ ->
                filterConfig.getRules().removeAt(position)
                adapter.notifyItemRemoved(position)
                saveFilterConfig()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private inner class FilterRulesAdapter(
        private val rules: MutableList<SMSFilterRule>,
    ) : RecyclerView.Adapter<FilterRulesAdapter.ViewHolder>() {
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_filter_rule, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val rule = rules[position]
            holder.patternText.text = rule.pattern

            holder.matchTypeText.text = when (rule.matchType) {
                SMSFilterRule.MatchType.EXACT -> "Exact Match"
                SMSFilterRule.MatchType.STARTS_WITH -> "Starts With"
                SMSFilterRule.MatchType.ENDS_WITH -> "Ends With"
                SMSFilterRule.MatchType.CONTAINS -> "Contains"
                null -> ""
            }

            val filterTargetText = when (rule.filterTarget) {
                SMSFilterRule.FilterTarget.SENDER -> "Filter: Sender"
                SMSFilterRule.FilterTarget.MESSAGE -> "Filter: Message"
                SMSFilterRule.FilterTarget.BOTH -> "Filter: Sender or Message"
            }
            val caseText = if (rule.isCaseSensitive()) " (Case Sensitive)" else " (Case Insensitive)"
            holder.filterTargetText.text = filterTargetText + caseText

            holder.editButton.setOnClickListener { showAddEditRuleDialog(position) }
            holder.deleteButton.setOnClickListener { deleteRule(position) }
        }

        override fun getItemCount(): Int = rules.size

        private inner class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
            val patternText: TextView = itemView.findViewById(R.id.patternText)
            val matchTypeText: TextView = itemView.findViewById(R.id.matchTypeText)
            val filterTargetText: TextView = itemView.findViewById(R.id.filterTargetText)
            val editButton: ImageButton = itemView.findViewById(R.id.editButton)
            val deleteButton: ImageButton = itemView.findViewById(R.id.deleteButton)
        }
    }
}
