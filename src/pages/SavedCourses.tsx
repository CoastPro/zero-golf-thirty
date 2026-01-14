import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, Check, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SavedCourse } from '../types/database.types';

const DEFAULT_PAR = [4, 4, 4, 3, 5, 4, 4, 3, 4, 4, 4, 4, 3, 5, 4, 4, 3, 4];

export default function SavedCourses() {
  const [courses, setCourses] = useState<SavedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  
  const [newCourseName, setNewCourseName] = useState('');
  const [newCoursePar, setNewCoursePar] = useState(DEFAULT_PAR);
  
  const [editName, setEditName] = useState('');
  const [editPar, setEditPar] = useState(DEFAULT_PAR);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_courses')
        .select('*')
        .order('name');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error loading courses:', error);
      alert('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const addCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('saved_courses')
        .insert([{
          name: newCourseName,
          course_par: newCoursePar
        }]);

      if (error) throw error;
      
      setNewCourseName('');
      setNewCoursePar(DEFAULT_PAR);
      setShowAddForm(false);
      loadCourses();
    } catch (error) {
      console.error('Error adding course:', error);
      alert('Failed to add course');
    }
  };

  const startEdit = (course: SavedCourse) => {
    setEditingCourse(course.id);
    setEditName(course.name);
    setEditPar(course.course_par);
  };

  const cancelEdit = () => {
    setEditingCourse(null);
    setEditName('');
    setEditPar(DEFAULT_PAR);
  };

  const saveEdit = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('saved_courses')
        .update({
          name: editName,
          course_par: editPar
        })
        .eq('id', courseId);

      if (error) throw error;
      setEditingCourse(null);
      loadCourses();
    } catch (error) {
      console.error('Error updating course:', error);
      alert('Failed to update course');
    }
  };

  const deleteCourse = async (courseId: string, courseName: string) => {
    if (!confirm(`Delete ${courseName}?`)) return;

    try {
      const { error } = await supabase
        .from('saved_courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;
      loadCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('Failed to delete course');
    }
  };

  const updateHolePar = (parArray: number[], holeIndex: number, value: string, setter: (par: number[]) => void) => {
    const newPar = [...parArray];
    newPar[holeIndex] = parseInt(value) || 3;
    setter(newPar);
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Saved Courses</h2>
          <p className="text-gray-600 mt-1">Manage your frequently used courses</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Course
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add New Course</h3>
          <form onSubmit={addCourse} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Name *
              </label>
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Pine Valley Golf Club"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Course Par</label>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Front 9</h4>
                  <div className="grid grid-cols-9 gap-2">
                    {newCoursePar.slice(0, 9).map((par, index) => (
                      <div key={index}>
                        <label className="block text-xs text-gray-600 mb-1 text-center">{index + 1}</label>
                        <input
                          type="number"
                          value={par}
                          onChange={(e) => updateHolePar(newCoursePar, index, e.target.value, setNewCoursePar)}
                          min="3"
                          max="5"
                          className="w-full px-2 py-2 border border-gray-300 rounded text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Back 9</h4>
                  <div className="grid grid-cols-9 gap-2">
                    {newCoursePar.slice(9, 18).map((par, index) => (
                      <div key={index + 9}>
                        <label className="block text-xs text-gray-600 mb-1 text-center">{index + 10}</label>
                        <input
                          type="number"
                          value={par}
                          onChange={(e) => updateHolePar(newCoursePar, index + 9, e.target.value, setNewCoursePar)}
                          min="3"
                          max="5"
                          className="w-full px-2 py-2 border border-gray-300 rounded text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Save Course
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600 mb-4">No saved courses yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add First Course
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map(course => {
            const isEditing = editingCourse === course.id;
            const parToShow = isEditing ? editPar : course.course_par;
            const totalPar = parToShow.reduce((a, b) => a + b, 0);

            return (
              <div key={course.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-xl font-bold px-4 py-2 border border-gray-300 rounded-lg w-full"
                      />
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Front 9</h4>
                          <div className="grid grid-cols-9 gap-2">
                            {editPar.slice(0, 9).map((par, index) => (
                              <div key={index}>
                                <label className="block text-xs text-gray-600 mb-1 text-center">{index + 1}</label>
                                <input
                                  type="number"
                                  value={par}
                                  onChange={(e) => updateHolePar(editPar, index, e.target.value, setEditPar)}
                                  min="3"
                                  max="5"
                                  className="w-full px-2 py-2 border border-gray-300 rounded text-center"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">Back 9</h4>
                          <div className="grid grid-cols-9 gap-2">
                            {editPar.slice(9, 18).map((par, index) => (
                              <div key={index + 9}>
                                <label className="block text-xs text-gray-600 mb-1 text-center">{index + 10}</label>
                                <input
                                  type="number"
                                  value={par}
                                  onChange={(e) => updateHolePar(editPar, index + 9, e.target.value, setEditPar)}
                                  min="3"
                                  max="5"
                                  className="w-full px-2 py-2 border border-gray-300 rounded text-center"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(course.id)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                          <Check className="w-4 h-4" />
                          Save
                        </button>
                        <button onClick={cancelEdit} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{course.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">Total Par: {totalPar}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(course)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => deleteCourse(course.id, course.name)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-18 gap-1 text-center text-sm">
                        {course.course_par.map((par, index) => (
                          <div key={index} className="bg-gray-50 rounded p-2">
                            <div className="text-xs text-gray-600">{index + 1}</div>
                            <div className="font-semibold">{par}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}