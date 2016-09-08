
namespace UI
{
	/// <summary>
	/// Displays a view.
	/// </summary>
	/// <param name="p_vewView">The view to display.</param>
	/// <param name="p_booModal">Wheher the view should be modal.</param>
	/// <returns>The return value of the displayed view.</returns>
	public delegate object ShowViewDelegate(IView p_vewView, bool p_booModal);

	/// <summary>
	/// Displays a message.
	/// </summary>
	/// <param name="p_vmgMessage">The properties of the message to display.</param>
	/// <returns>The return value of the displayed message.</returns>
	public delegate object ShowMessageDelegate(ViewMessage p_vmgMessage);

	/// <summary>
	/// Confirms an action.
	/// </summary>
	/// <param name="p_strMessage">The message describing the action to confirm.</param>
	/// <param name="p_strTitle">The title of the action to confirm.</param>
	/// <returns><c>true</c> if the action has been confirmed;
	/// <c>false</c> otherwise.</returns>
	public delegate bool ConfirmActionMethod(string p_strMessage, string p_strTitle);

	/// <summary>
	/// This asks the user to confirm the overwriting of the specified item.
	/// </summary>
	/// <param name="p_strItemMessage">The message describing the item being overwritten..</param>
	/// <param name="p_booAllowPerGroupChoice">Whether to allow the user to make the decision to make the selection for all items in the current item's group.</param>
	/// <param name="p_booAllowPerModChoice">Whether to allow the user to make the decision to make the selection for all items in the current Mod.</param>
	/// <returns>The user's choice.</returns>
	public delegate OverwriteResult ConfirmItemOverwriteDelegate(string p_strItemMessage, bool p_booAllowPerGroupChoice, bool p_booAllowPerModChoice);
}
