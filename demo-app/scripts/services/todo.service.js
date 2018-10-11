plz.define('todo-service', function() {

    var _todos = [{
        id: 1,
        title: 'Kids',
        text: 'Pick up kids from kindergarten',
        isCompleted: true
    }, {
        id: 2,
        title: 'Happy wife',
        text: 'Buy flowers',
        isCompleted: false
    }];

    var _get = function(isCompleted) {
        return plz.arr.filter(function(todo) {
            return (isCompleted == todo.isCompleted) ? true : false;
        }, _todos);
    };

    return {
        ownerType: 'class',
        get: function() {
            return _todos;
        },
        put: function(todo) {
            var json = plz.binder.toJSON(todo);
            _todos.push(json);
        },
        delete: function(idx) {
            plz.arr.removeAt(_todos, idx);
        },
        clear: function(idx) {
            plz.arr.clear(_todos);
        },
        getCompleted: function() {
            return _get(true);
        },
        getUnCompleted: function() {
            return _get(false);
        }
    }
});