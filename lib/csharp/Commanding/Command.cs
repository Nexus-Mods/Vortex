using System;
using System.ComponentModel;
using System.Drawing;

namespace Commands
{
	/// <summary>
	/// The delegate for the method that executes the command.
	/// </summary>
	public delegate void CommandExecuterMethod();
	
	/// <summary>
	/// The base class for commands.
	/// </summary>
	public class Command : CommandBase
	{
		/// <summary>
		/// Raised when the command has been executed.
		/// </summary>
		public event EventHandler<CancelEventArgs> BeforeExecute = delegate { };

		/// <summary>
		/// Raised when the command has been executed.
		/// </summary>
		public event EventHandler Executed = delegate { };

		/// <summary>
		/// The method that executes the command.
		/// </summary>
		protected CommandExecuterMethod ExecuteMethod = delegate { };

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod"/> that will be
		/// perform the command work.</param>
		public Command(string p_strName, string p_strDescription, CommandExecuterMethod p_eehExecute)
			: this(null, p_strName, p_strDescription, null, p_eehExecute, true)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod"/> that will be
		/// perform the command work.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public Command(string p_strName, string p_strDescription, CommandExecuterMethod p_eehExecute, bool p_booCanExecute)
			: this(null, p_strName, p_strDescription, null, p_eehExecute, p_booCanExecute)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strId">The id of the command</param>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_imgImage">The image of the command.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod"/> that will be
		/// perform the command work.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public Command(string p_strId, string p_strName, string p_strDescription, Image p_imgImage, CommandExecuterMethod p_eehExecute, bool p_booCanExecute)
			: base(p_strId, p_strName, p_strDescription, p_imgImage, p_booCanExecute)
		{
			ExecuteMethod = p_eehExecute;
		}

		#endregion

		/// <summary>
		/// Executes the command.
		/// </summary>
		public void Execute()
		{
			if (CanExecute)
			{
				CancelEventArgs caeArg = new CancelEventArgs();
				BeforeExecute(this, caeArg);
				if (caeArg.Cancel)
					return;
				ExecuteMethod();
				Executed(this, new EventArgs());
			}
		}
	}
}
