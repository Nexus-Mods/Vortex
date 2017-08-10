using System;
using System.IO;
using System.Windows.Forms;

namespace Nexus.Client.ModManagement.Scripting.ModScript.UI
{
	/// <summary>
	/// A basic text editor that.
	/// </summary>
	public partial class TextEditor : Form
	{
		/// <summary>
		/// Displays the text editor in modal form.
		/// </summary>
		/// <param name="p_strTitle">The title of the editor.</param>
		/// <param name="p_strInitialValue">The initial value of the editor.</param>
		/// <param name="p_booReadOnly">Whether the text editor should be read only.</param>
		/// <returns>The entered text.</returns>
		public static string Show(string p_strTitle, string p_strInitialValue, bool p_booReadOnly)
		{
			TextEditor tefEditor = new TextEditor(p_strTitle, p_strInitialValue, p_booReadOnly);
			tefEditor.ShowDialog();
			return tefEditor.EditedText;
		}

		#region Properties

		/// <summary>
		/// Gets the text in the editor.
		/// </summary>
		/// <value>The text in the editor.</value>
		public string EditedText
		{
			get
			{
				if (DialogResult == DialogResult.Cancel)
					return null;
				return tbxText.Text;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strTitle">The title of the editor.</param>
		/// <param name="p_strInitialValue">The initial value of the editor.</param>
		/// <param name="p_booReadOnly">Whether the text editor should be read only.</param>
		public TextEditor(string p_strTitle, string p_strInitialValue, bool p_booReadOnly)
		{
			InitializeComponent();
			Text = p_strTitle;
			tbxText.Text = p_strInitialValue;
			tbxText.ReadOnly = p_booReadOnly;
			tsbOpen.Enabled = !p_booReadOnly;
		}

		#endregion

		/// <summary>
		/// Handles the <see cref="ToolStripItem.Click"/> event of the open button.
		/// </summary>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">An <see cref="EventArgs"/> describing the event arguments.</param>
		private void tsbOpen_Click(object sender, EventArgs e)
		{
			if (ofdOpenFile.ShowDialog(this) == DialogResult.OK)
				tbxText.Text = File.ReadAllText(ofdOpenFile.FileName);
		}

		/// <summary>
		/// Handles the <see cref="ToolStripItem.Click"/> event of the save button.
		/// </summary>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">An <see cref="EventArgs"/> describing the event arguments.</param>
		private void tsbSave_Click(object sender, EventArgs e)
		{
			if (sfdSaveFile.ShowDialog(this) == DialogResult.OK)
				File.WriteAllText(sfdSaveFile.FileName, tbxText.Text);
		}
	}
}
