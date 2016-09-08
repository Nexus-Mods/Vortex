using System.Collections.Generic;
using UI;

namespace Scripting
{
	public interface IUI
	{
		/// <summary>
		/// Displays an extended message box.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strCaption">The caption of the message box.</param>
		/// <param name="p_strDetails">The details to display.</param>
		/// <param name="p_mbbButtons">The buttons to show on the message box.</param>
		/// <param name="p_mbiIcon">The icon to show on the message box.</param>
		/// <returns>The <see cref="DialogResult"/> corressponding to the button pushed on the message box.</returns>
		DialogResult ShowExtendedMessageBox(string p_strMessage, string p_strCaption, string p_strDetails,
			MessageBoxButtons p_mbbButtons, MessageBoxIcon p_mbiIcon);

		/// <summary>
		/// Displays a message box.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strCaption">The caption of the message box.</param>
		/// <param name="p_mbbButtons">The buttons to show on the message box.</param>
		/// <param name="p_mbiIcon">The icon to show on the message box.</param>
		/// <returns>The <see cref="DialogResult"/> corressponding to the button pushed on the message box.</returns>
		DialogResult ShowMessageBox(string p_strMessage, string p_strCaption,
			MessageBoxButtons p_mbbButtons, MessageBoxIcon p_mbiIcon);


		/// <summary>
		/// Displays a simple message box.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <returns>The <see cref="DialogResult"/> corressponding to the button pushed on the message box.</returns>
		DialogResult ShowMessageBox(string p_strMessage);

		/// <summary>
		/// Displays a message box.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strCaption">The caption of the message box.</param>
		/// <returns>The <see cref="DialogResult"/> corressponding to the button pushed on the message box.</returns>
		DialogResult ShowMessageBox(string p_strMessage, string p_strCaption);

		/// <summary>
		/// Displays a message box.
		/// </summary>
		/// <param name="p_strMessage">The message to display.</param>
		/// <param name="p_strCaption">The caption of the message box.</param>
		/// <param name="p_mbbButtons">The buttons to show on the message box.</param>
		/// <returns>The <see cref="DialogResult"/> corressponding to the button pushed on the message box.</returns>
		DialogResult ShowMessageBox(string p_strMessage, string p_strCaption, MessageBoxButtons p_mbbButtons);

		/// <summary>
		/// Displays a selection form to the user.
		/// </summary>
		/// <param name="p_lstOptions">The options from which to select.</param>
		/// <param name="p_strTitle">The title of the selection form.</param>
		/// <param name="p_booSelectMany">Whether more than one items can be selected.</param>
		/// <returns>The selected option names.</returns>
		string[] Select(IList<SelectOption> p_lstOptions, string p_strTitle, bool p_booSelectMany);
	}
}
