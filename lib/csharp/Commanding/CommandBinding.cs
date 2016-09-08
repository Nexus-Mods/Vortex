namespace Commands
{
	/// <summary>
	/// The base class for binding a command to a command trigger.
	/// </summary>
	public abstract class CommandBinding : CommandBindingBase
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_objTrigger">The object that can trigger the command.</param>
		/// <param name="p_cmdCommand">The command that can be triggered.</param>
		protected CommandBinding(object p_objTrigger, Command p_cmdCommand)
			: base(p_objTrigger, p_cmdCommand)
		{
		}

		#endregion

		/// <summary>
		/// Executes the command.
		/// </summary>
		public override void Execute()
		{
			((Command)Command).Execute();
		}
	}
}
