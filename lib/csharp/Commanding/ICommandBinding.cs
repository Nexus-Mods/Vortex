namespace Commands
{
	/// <summary>
	/// The interface for command bindings.
	/// </summary>
	public interface ICommandBinding
	{
		#region Properties

		/// <summary>
		/// Gets the object that can trigger the command.
		/// </summary>
		/// <value>The object that can trigger the command.</value>
		object Trigger { get; }

		/// <summary>
		/// Gets the command that can be triggered.
		/// </summary>
		/// <value>The command that can be triggered.</value>
		ICommand Command { get; }

		#endregion

		/// <summary>
		/// Executes the command.
		/// </summary>
		void Execute();

		/// <summary>
		/// Disposes of the binding.
		/// </summary>
		/// <remarks>
		/// After this method is called, the binding between the trigger
		/// and command should no longer exist. In other words, activating the trigger should no
		/// longer execute the command.
		/// </remarks>
		void Unbind();
	}
}
