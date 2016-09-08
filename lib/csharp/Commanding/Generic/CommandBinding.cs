namespace Commands.Generic
{
	/// <summary>
	/// The base class for binding a command to a command trigger.
	/// </summary>
	/// <typeparam name="T">The type of the command argument.</typeparam>
	public abstract class CommandBinding<T> : CommandBindingBase
	{
		/// <summary>
		/// The delegate for the method that returns the command argument.
		/// </summary>
		/// <returns>The command argument.</returns>
		public delegate T GetCommandArgument();

		private GetCommandArgument m_dlgGetArgument = null;

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_objTrigger">The object that can trigger the command.</param>
		/// <param name="p_cmdCommand">The command that can be triggered.</param>
		/// <param name="p_dlgGetArgument">The method that returns the command argument.</param>
		protected CommandBinding(object p_objTrigger, Command<T> p_cmdCommand, GetCommandArgument p_dlgGetArgument)
			:base(p_objTrigger,p_cmdCommand)
		{
			m_dlgGetArgument = p_dlgGetArgument;
		}

		#endregion

		/// <summary>
		/// Executes the command.
		/// </summary>
		public override void Execute()
		{
			((Command<T>)Command).Execute((m_dlgGetArgument == null) ? default(T) : m_dlgGetArgument());
		}
	}
}
