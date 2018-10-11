plz.define('todo-component', function() {
    
    var _styles = [
        'is-primary',
        'is-warning',
        'is-info',
        'is-success',
        'is-danger'
    ];

    return {
        ownerType: 'base-component',
        mixins: ['page-mixin'],
        template: '<div>' + // template can also be retrieved from the server via ajaxSetup config
            '<div class="field">' + 
                '<label class="label">TODO:</label>' + 
                '<div class="control">' + 
                    '<input class="input" data-value="newTodo.title" placeholder="Example: Shopping" />' + 
                '</div>' + 
            '</div>' + 
            '<div class="field">' + 
                '<div class="control">' + 
                    '<textarea class="textarea" data-value="newTodo.text" placeholder="Example: Go to the grocery store"></textarea>' + 
                '</div>' + 
            '</div>' + 
            '<div class="field is-grouped">' + 
                '<div class="control">' + 
                    '<button class="button btn-add">Add</button>' + 
                '</div>' +
            '</div>' + 
            '<article data-each="todos" class="message">' + 
                '<div class="message-header">' + 
                    '<p>{title}</p>' + 
                    '<button class="delete btn-delete" data-attr-[data-idx]="$index" aria-label="delete"></button>' + 
                '</div>' + 
                '<div class="message-body">{text}</div>' + 
            '</article>' + 
        '</div>',
        renderTo: 'section.app-body',
        viewModel: {
            todos: [],
            newTodo: {
                text: '',
                title: '',
                cssStyle: 'is-primary',
                isCompleted: false
            }
        },
        handlers: [{
            on: 'click',
            selector: 'button.btn-delete',
            fn: function(el) { // can be inline fn or component fn (name: String)
                var idx = el.getAttribute('data-idx');
                plz.arr.removeAt(this.viewModel.todos, idx);
                this.todoService.delete(idx);
            }
        }],
        init: function() {
            this.handle({ // example of dynamic event
                on: 'click',
                selector: 'button.btn-add',
                fn: 'addTodo'
            });
            
            this.viewModel.todos = this.todoService.get();
            this.base(arguments);
        },
        addTodo: function() {
            var random = Math.floor((Math.random() * (5 - 0) + 0));
            var todo = {
                text: this.viewModel.newTodo.text(),
                title: this.viewModel.newTodo.title(),
                cssStyle: _styles[random]
            };
            this.viewModel.todos.push(todo);
            this.viewModel.newTodo.text = '';
            this.viewModel.newTodo.title = '';
            this.todoService.put(todo);
        },
        require: ['todo-service']
    };

});