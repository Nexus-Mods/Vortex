using Xunit;
using Scripting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using NSubstitute;
using Util.BackgroundTasks;
using Util;
using NSubstitute.Core;

namespace Scripting.Tests
{
	public class ScriptExecutorBaseTests
	{
		[Fact]
		public void ExecuteTest()
		{
			// setup
			bool completed = false;
			object retval = null;

			IScript script = Substitute.For<IScript>();
			ScriptExecutorBase executor = Substitute.ForPartsOf<ScriptExecutorBase>();
			executor.DoExecute(script).Returns(true);
			executor.TaskSetCompleted += (object sender, TaskSetCompletedEventArgs args) => {
				completed = args.Success;
				retval = args.ReturnValue;
			};

			// execution
			executor.Execute(script);
			executor.Wait();

			// test everything was called correctly
			executor.Received().DoExecute(script);
			Assert.True(executor.IsCompleted);
			Assert.True(completed);
			Assert.Same(retval, script);
		}
	}
}