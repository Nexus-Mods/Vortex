using System;
using System.Drawing;
using Util;

namespace Commands.Generic
{
	/// <summary>
	/// The delegate for the method that executes the command with an argument.
	/// </summary>
	/// <param name="p_tArgument">The command argument.</param>
	public delegate void CommandExecuterMethod<T>(T p_tArgument);

	/// <summary>
	/// A command that requires an argument.
	/// </summary>
	/// <typeparam name="T">The type of the command argument.</typeparam>
	public class Command<T> : CommandBase
	{
		/// <summary>
		/// Raised when the command has been executed.
		/// </summary>
		public event EventHandler<CancelEventArgs<T>> BeforeExecute = delegate { };

		/// <summary>
		/// Raised when the command has been executed.
		/// </summary>
		public event EventHandler<EventArgs<T>> Executed = delegate { };

		/// <summary>
		/// The method that executes the command.
		/// </summary>
		protected CommandExecuterMethod<T> ExecuteMethod = delegate { };

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod{T}"/> that will be
		/// perform the command work.</param>
		public Command(string p_strName, string p_strDescription, CommandExecuterMethod<T> p_eehExecute)
			: this(null, p_strName, p_strDescription, null, p_eehExecute, true)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod{T}"/> that will be
		/// perform the command work.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public Command(string p_strName, string p_strDescription, CommandExecuterMethod<T> p_eehExecute, bool p_booCanExecute)
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
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod{T}"/> that will be
		/// perform the command work.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public Command(string p_strId, string p_strName, string p_strDescription, Image p_imgImage, CommandExecuterMethod<T> p_eehExecute, bool p_booCanExecute)
			: base(p_strId, p_strName, p_strDescription, p_imgImage, p_booCanExecute)
		{
			ExecuteMethod = p_eehExecute;
		}

		#endregion

		/// <summary>
		/// Executes the command.
		/// </summary>
		/// <param name="p_tArgument">The command argument.</param>
		public void Execute(T p_tArgument)
		{
			if (CanExecute)
			{
				CancelEventArgs<T> caeArg = new CancelEventArgs<T>(p_tArgument);
				BeforeExecute(this, caeArg);
				if (caeArg.Cancel)
					return;
				ExecuteMethod(p_tArgument);
				Executed(this, new EventArgs<T>(p_tArgument));
			}
		}
	}
}
